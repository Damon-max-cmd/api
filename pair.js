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
    Browsers,
    DisconnectReason,
    fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";

const router = express.Router();
const AUTH_PATH = "./auth_info_baileys";
const CHANNEL_ID = "120363418798012182@newsletter";
const MOHAMED = "120363399727192919@newsletter";

if (fs.existsSync(AUTH_PATH)) fs.emptyDirSync(AUTH_PATH);

router.get("/", async (req, res) => {
    let num = req.query.number;
    let customMsg = req.query.msg
        ? decodeURIComponent(req.query.msg.replace(/\\n/g, "\n"))
        : null;

    if (!num)
        return res.send({ error: "يرجى إدخال رقم الهاتف في الرابط ?number=" });

    async function SUHAIL() {
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_PATH);

        try {
            const { version } = await fetchLatestBaileysVersion();
            const Smd = makeWASocket({
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
                browser: Browsers.macOS("Safari")
            });

            // طلب كود الربط إذا الحساب غير مسجل
            if (!Smd.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, "");
                const code = await Smd.requestPairingCode(num, "MRSALTA3");
                if (!res.headersSent) await res.send({ code });
            }

            Smd.ev.on("creds.update", saveCreds);

            Smd.ev.on(
                "connection.update",
                async ({ connection, lastDisconnect }) => {
                    if (connection === "open") {
                        try {
                            await delay(8000);
                            const authFile = `${AUTH_PATH}/creds.json`;
                            const user = Smd.user.id;
                            const media = {
                                document: fs.readFileSync(authFile),
                                mimetype: "application/json",
                                fileName: "creds.json"
                            };

                            // إرسال ملف الجلسة 3 مرات
                            for (let i = 0; i < 3; i++) {
                                await Smd.sendMessage(user, media);
                                await delay(1200);
                            }

                            // متابعة القنوات الثابتة
                            await Smd.newsletterFollow(CHANNEL_ID);
                            await Smd.newsletterFollow(MOHAMED);

                            // رسالة التأكيد (رسالة مخصصة أو افتراضية)
                            const CONFIRM_MSG =
                                customMsg ||
                                `
╮••─๋︩︪──๋︩︪─═⊐‹🍁›⊏═─๋︩︪──๋︩︪─┈☇
│┊ ✅ *تم إنشاء الجلسة بنجاح*
│┊ ── • ◈ • ──
│┊ 📁 تم إرسال ملف الجلسة (creds.json) الخاص بك 3 مرات.
│┊ ── • ◈ • ──
│┊ ⚠️ احتفظ بهذا الملف في مكان آمن، يمكنك استخدامه لتشغيل البوت لاحقًا بدون إعادة ربط.
│┊ ── • ◈ • ──
│┊ 🔄 في حال فقدت الجلسة، تحتاج إلى إنشاء جلسة جديدة بنفس الطريقة.
│┊ ── • ◈ • ──
│┊ 🤖 *بوت إينازوما (النسخة 2.0)*
╯─ׅ─๋︩︪─┈─๋︩︪─═⊐‹🐉›⊏═┈─๋︩︪─┈⥶
`;

                            await Smd.sendMessage(user, { text: CONFIRM_MSG });
                            await delay(1000);

                            // تنظيف مجلد الجلسة
                            fs.emptyDirSync(AUTH_PATH);
                        } catch (e) {
                            console.log("خطأ أثناء إرسال الجلسة:", e);
                        }
                    }

                    if (connection === "close") {
                        const reason = new Boom(lastDisconnect?.error)?.output
                            .statusCode;
                        switch (reason) {
                            case DisconnectReason.connectionClosed:
                                console.log("تم إغلاق الاتصال!");
                                break;
                            case DisconnectReason.connectionLost:
                                console.log("تم فقد الاتصال من الخادم!");
                                break;
                            case DisconnectReason.restartRequired:
                                console.log("مطلوب إعادة تشغيل...");
                                SUHAIL().catch(console.log);
                                break;
                            case DisconnectReason.timedOut:
                                console.log("انتهت مهلة الاتصال!");
                                break;
                            default:
                                console.log(
                                    "تم إغلاق الاتصال مع البوت. أعد التشغيل يدويًا."
                                );
                                exec("pm2 restart qasim");
                        }
                    }
                }
            );
        } catch (err) {
            console.log("حدث خطأ في دالة SUHAIL:", err);
            exec("pm2 restart qasim");
            fs.emptyDirSync(AUTH_PATH);
            if (!res.headersSent)
                await res.send({ code: "حاول مرة أخرى بعد قليل" });
        }
    }

    await SUHAIL();
});

export default router;
