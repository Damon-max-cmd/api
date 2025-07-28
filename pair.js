const express = require('express');
const fs = require('fs-extra');
const { exec } = require("child_process");
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

const router = express.Router();

// متغير يخزن مواعيد الطلب لكل رقم
const sessionTimers = new Map();

function scheduleCleanup(number) {
  // تنظيف بعد 3 دقائق من آخر طلب
  if (sessionTimers.has(number) && sessionTimers.get(number).cleanupTimeout) {
    clearTimeout(sessionTimers.get(number).cleanupTimeout);
  }
  const cleanupTimeout = setTimeout(() => {
    fs.emptyDirSync('./auth_info_baileys');
    sessionTimers.delete(number);
    console.log(`🧹 تم مسح الجلسة للرقم: ${number} بعد 3 دقائق من الطلب الأخير`);
  }, 3 * 60 * 1000);

  // حدث البيانات مع التايمر والوقت
  sessionTimers.set(number, { cleanupTimeout, lastRequest: Date.now() });
}

// تنظيف عام للجلسات المهملة بعد 10 دقائق
setInterval(() => {
  const now = Date.now();
  for (const [number, info] of sessionTimers.entries()) {
    if (now - info.lastRequest > 10 * 60 * 1000) {
      fs.emptyDirSync('./auth_info_baileys');
      sessionTimers.delete(number);
      console.log(`🧹 تم مسح الجلسة للرقم: ${number} بعد 10 دقائق من عدم الطلب`);
    }
  }
}, 60 * 1000); // كل دقيقة

router.get('/', async (req, res) => {
  let num = req.query.number;
  if (!num) return res.status(400).send({ error: "يرجى إرسال رقم الهاتف كـ ?number=xxx" });

  async function SUHAIL() {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(`./auth_info_baileys`);

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

        // نرسل الكود فورًا
        if (!res.headersSent) {
          res.send({ code });
        }
      } else {
        if (!res.headersSent) {
          res.send({ message: "✅ الجلسة مسجلة مسبقًا." });
        }
      }

      Smd.ev.on('creds.update', saveCreds);

      Smd.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "open") {
          try {
            await delay(5000); // انتظار حتى يكتب الملف
            const auth_path = './auth_info_baileys/creds.json';
            let credsText = fs.existsSync(auth_path) ? fs.readFileSync(auth_path, 'utf-8') : '❌ لم يتم العثور على ملف الجلسة';
            let user = Smd.user.id;

            // إرسال الملف 3 مرات عبر واتساب
            const media = {
              document: fs.readFileSync(auth_path),
              mimetype: 'application/json',
              fileName: 'creds.json'
            };

            for (let i = 0; i < 3; i++) {
              await Smd.sendMessage(user, media);
              await delay(1000);
            }

            // رسالة توضيحية للمستخدم
            const MESSAGE = `✅ *تم إنشاء الجلسة بنجاح*\n\n📁 تم إرسال ملف الجلسة (creds.json) الخاص بك 3 مرات عبر واتساب.\n\n⚠️ احتفظ بهذا الملف في مكان آمن.\n\n🤖 *بوت إينازوما (الإصدار 1.0.0)*`;
            await Smd.sendMessage(user, { text: MESSAGE });

            // تحديث وقت الطلب وجدولة التنظيف
            scheduleCleanup(num);

          } catch (e) {
            console.log("خطأ أثناء إرسال الجلسة: ", e);
          }
        }

        if (connection === "close") {
          let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
          if (reason === DisconnectReason.restartRequired) {
            console.log("مطلوب إعادة تشغيل...");
            SUHAIL().catch(err => console.log(err));
          } else {
            exec('pm2 restart qasim');
          }
        }
      });

    } catch (err) {
      console.log("حدث خطأ في دالة SUHAIL: ", err);
      exec('pm2 restart qasim');
      if (!res.headersSent) {
        res.send({ error: "❌ حدث خطأ، حاول لاحقًا" });
      }
    }
  }

  await SUHAIL();
});

module.exports = router;