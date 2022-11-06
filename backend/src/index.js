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

app.listen(process.env.PORT || 3001, function() {
	console.log('Express app running on port ' + (process.env.PORT || 3001))
});