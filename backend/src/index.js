const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');

const routes = require('./routes');

const app = express();

app.use(cors());
app.use(morgan(':method :url :status :user-agent - :response-time ms'));
app.use(bodyParser.json());

app.use('/', routes);

const port = process.env.PORT || 3001;
app.listen(port, function () {
  const keyOk = Boolean(process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY.trim());
  console.log('Express app running on port ' + port);
  console.log('DEEPSEEK_API_KEY: ' + (keyOk ? 'configurada' : 'NO configurada'));
});