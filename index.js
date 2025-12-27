import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __path = dirname(__filename);
const PORT = process.env.PORT || 3877;

// استيراد الكود من ملف pair.js
import code from './pair.js';

// زيادة الحد الأقصى للاستماع للأحداث
import events from 'events';
events.EventEmitter.defaultMaxListeners = 500;

app.use('/code', code);
app.use('/pair', async (req, res, next) => {
  res.sendFile(__path + '/pair.html');
});
app.use('/', async (req, res, next) => {
  res.sendFile(__path + '/main.html');
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:` + PORT);
});

setInterval(() => {
  fetch(`https://api-ayos.onrender.com/`)
    .then(() => console.log('✅ Self ping successful'))
    .catch(err => console.error('❌ Self ping failed:', err));
}, 13 * 60 * 1000);

// تصدير التطبيق
export default app;