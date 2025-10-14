const express = require('express');
const app = express();
__path = process.cwd();
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 3877;

const code = require('./pair');
require('events').EventEmitter.defaultMaxListeners = 500;

app.use('/code', code);
app.use('/pair', async (req, res, next) => {
  res.sendFile(__path + '/pair.html');
});
app.use('/', async (req, res, next) => {
  res.sendFile(__path + '/main.html');
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:` + PORT);
});
setInterval(() => {
  fetch(`https://api-ayos.onrender.com/`)
    .then(() => console.log('✅ Self ping successful'))
    .catch(err => console.error('❌ Self ping failed:', err));
}, 13 * 60 * 1000);
module.exports = app;