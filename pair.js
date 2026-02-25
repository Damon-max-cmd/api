

import express from "express";
import fs from "fs-extra";
import { exec } from "child_process";
import pino from "pino";
import { Boom } from "@hapi/boom";
import {
    makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    DisconnectReason,
    fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";

const router = express.Router();
const AUTH_PATH = "./auth_info_baileys";

if (fs.existsSync(AUTH_PATH)) fs.emptyDirSync(AUTH_PATH);

router.get("/", async (req, res) => {
    let num = req.query.number;
    let customMsg = req.query.msg
        ? decodeURIComponent(req.query.msg.replace(/\\n/g, "\n"))
        : null;

    if (!num)
        return res.send({ error: "يرجى إدخال رقم الهاتف في الرابط ?number=" });

    async function startSocket() {
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_PATH);

        try {
            const { version } = await fetchLatestBaileysVersion();

            const sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(
                        state.keys,
                        pino({ level: "silent" })
                    )
                },
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                browser: ["Ubuntu", "Chrome", "20.0.04"]
            });

            if (!sock.authState.creds.registered) {
                await delay(2000);
                num = num.replace(/[^0-9]/g, "");
                const code = await sock.requestPairingCode(num, "DAMON512");
                if (!res.headersSent) await res.send({ code });
            }

            sock.ev.on("creds.update", saveCreds);

            sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {

                if (connection === "open") {
                    try {
                        console.log("✅ Connected successfully");

                        // ⏳ مهم جداً على Render
                        await delay(15000);

                        const authFile = `${AUTH_PATH}/creds.json`;

                        // 🔥 إصلاح JID
                        const user =
                            sock.user.id.split(":")[0] + "@s.whatsapp.net";

                        // 🔥 قراءة الملف كـ Buffer (أفضل لـ Render)
                        const fileBuffer = fs.readFileSync(authFile);

                        const media = {
                            document: fileBuffer,
                            mimetype: "application/json",
                            fileName: "creds.json"
                        };

                        // إرسال الملف 3 مرات
                        for (let i = 0; i < 3; i++) {
                            await sock.sendMessage(user, media);
                            await delay(2000);
                        }

                        const CONFIRM_MSG =
                            customMsg ||
                            `✅ تم إنشاء الجلسة بنجاح
📁 تم إرسال ملف الجلسة (creds.json)
⚠️ احتفظ بالملف في مكان آمن`;

                        await sock.sendMessage(user, { text: CONFIRM_MSG });

                        await delay(2000);

                        // تنظيف مجلد الجلسة
                        fs.emptyDirSync(AUTH_PATH);

                        console.log("✅ Session sent successfully");

                    } catch (err) {
                        console.log("❌ Error while sending file:", err);
                    }
                }

                if (connection === "close") {
                    const reason =
                        new Boom(lastDisconnect?.error)?.output?.statusCode;

                    switch (reason) {
                        case DisconnectReason.connectionClosed:
                            console.log("Connection closed");
                            break;
                        case DisconnectReason.connectionLost:
                            console.log("Connection lost");
                            break;
                        case DisconnectReason.restartRequired:
                            console.log("Restart required");
                            startSocket().catch(console.log);
                            break;
                        case DisconnectReason.timedOut:
                            console.log("Connection timed out");
                            break;
                        default:
                            console.log("Restarting via PM2");
                            exec("pm2 restart qasim");
                    }
                }
            });

        } catch (err) {
            console.log("❌ General error:", err);
            exec("pm2 restart qasim");
            fs.emptyDirSync(AUTH_PATH);
            if (!res.headersSent)
                await res.send({ code: "حاول مرة أخرى بعد قليل" });
        }
    }

    await startSocket();
});

export default router;
