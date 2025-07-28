const express = require('express');
const fs = require('fs-extra');
const { exec } = require("child_process");
let router = express.Router();
const pino = require("pino");
const { Boom } = require("@hapi/boom");

const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    DisconnectReason
} = require("@whiskeysockets/baileys");

if (fs.existsSync('./auth_info_baileys')) {
    fs.emptyDirSync(__dirname + '/auth_info_baileys');
}

router.get('/', async (req, res) => {
    let num = req.query.number;

    async function SUHAIL() {
        const { state, saveCreds } = await useMultiFileAuthState(`./auth_info_baileys`);
        try {
            let Smd = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
            });

            if (!Smd.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await Smd.requestPairingCode(num, 'GINAZUMA');
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            Smd.ev.on('creds.update', saveCreds);
            Smd.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    try {
                        await delay(10000);
                        const auth_path = './auth_info_baileys/creds.json';
                        let user = Smd.user.id;

                        const media = { document: fs.readFileSync(auth_path), mimetype: 'application/json', fileName: 'creds.json' };

                        for (let i = 0; i < 3; i++) {
                            await Smd.sendMessage(user, media);
                            await delay(1000);
                        }

                        const MESSAGE = `
✅ *تم إنشاء الجلسة بنجاح*

📁 تم إرسال ملف الجلسة (creds.json) الخاص بك 3 مرات.

⚠️ احتفظ بهذا الملف في مكان آمن، يمكنك استخدامه لتشغيل البوت لاحقًا بدون إعادة ربط.

🔄 في حال فقدت الجلسة، تحتاج إلى إنشاء جلسة جديدة بنفس الطريقة.

🤖 *بوت إينازوما (الإصدار 1.0.0)*

`;

                        await Smd.sendMessage(user, { text: MESSAGE });
                        await delay(1000);
                        fs.emptyDirSync(__dirname + '/auth_info_baileys');

                    } catch (e) {
                        console.log("خطأ أثناء إرسال الجلسة: ", e);
                    }

                    await delay(100);
                    fs.emptyDirSync(__dirname + '/auth_info_baileys');
                }

                if (connection === "close") {
                    let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
                    if (reason === DisconnectReason.connectionClosed) {
                        console.log("تم إغلاق الاتصال!");
                    } else if (reason === DisconnectReason.connectionLost) {
                        console.log("تم فقد الاتصال من الخادم!");
                    } else if (reason === DisconnectReason.restartRequired) {
                        console.log("مطلوب إعادة تشغيل... يتم إعادة التشغيل");
                        SUHAIL().catch(err => console.log(err));
                    } else if (reason === DisconnectReason.timedOut) {
                        console.log("انتهت مهلة الاتصال!");
                    } else {
                        console.log('تم إغلاق الاتصال مع البوت. أعد التشغيل يدويًا.');
                        exec('pm2 restart qasim');
                    }
                }
            });

        } catch (err) {
            console.log("حدث خطأ في دالة SUHAIL: ", err);
            exec('pm2 restart qasim');
            console.log("تم إعادة تشغيل الخدمة بسبب الخطأ");
            SUHAIL();
            fs.emptyDirSync(__dirname + '/auth_info_baileys');
            if (!res.headersSent) {
                await res.send({ code: "حاول مرة أخرى بعد قليل" });
            }
        }
    }

    await SUHAIL();
});

module.exports = router;

