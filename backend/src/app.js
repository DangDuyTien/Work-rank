const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const tradingViewController = require('./controllers/tradingView.controller');
const corsOptions = require('./utils/corsOptions');
const { notFound, errorHandler } = require('./middlewares/error.middleware');
const { authLimiter, apiLimiter } = require('./middlewares/rateLimit.middleware');
const asyncHandler = require('./utils/asyncHandler');

const healthController = require('./controllers/health.controller');

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      workerSrc: ["'self'", "blob:"],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: ["'self'", 'https:', 'wss:', 'ws:', '*'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(morgan('combined', { skip: (req) => req.path.startsWith('/health') || req.path.startsWith('/api/health') }));
app.use(cors(corsOptions));
app.use(express.json({
  limit: '5mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Root health probes (Liveness / Readiness / Detailed Health)
app.get('/health', asyncHandler(healthController.health));
app.get('/health/live', asyncHandler(healthController.live));
app.get('/health/ready', asyncHandler(healthController.ready));

app.post('/webhook/tradingview', asyncHandler(tradingViewController.receiveWebhook));
app.get('/debug/tradingview', asyncHandler(tradingViewController.debug));
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);
app.use('/api', routes);

if (process.env.NODE_ENV === 'production') {
  const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDistPath));
  app.get(/^(?!\/api).*/, (req, res, next) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'), (error) => {
      if (error) next();
    });
  });
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
