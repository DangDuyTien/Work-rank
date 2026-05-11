const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const corsOptions = require('./utils/corsOptions');
const { notFound, errorHandler } = require('./middlewares/error.middleware');
const { authLimiter, activityLimiter, apiLimiter } = require('./middlewares/rateLimit.middleware');

const app = express();
app.use(helmet());
app.use(morgan('combined', { skip: (req) => req.path === '/api/health' }));
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api/auth', authLimiter);
app.use('/api/activity', activityLimiter);
app.use('/api', apiLimiter);
app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
