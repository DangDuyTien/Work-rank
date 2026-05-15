const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const corsOptions = require('./utils/corsOptions');
const { notFound, errorHandler } = require('./middlewares/error.middleware');
const { authLimiter, activityLimiter, apiLimiter } = require('./middlewares/rateLimit.middleware');

const app = express();
const DOWNLOADABLE_DESKTOP_FILES = new Set([
  'WorkRank Tracker-Setup-1.0.0-x64.exe',
  'WorkRank Tracker-Portable-1.0.0-x64.exe',
]);
const DESKTOP_DOWNLOAD_REDIRECTS = {
  'WorkRank Tracker-Setup-1.0.0-x64.exe': process.env.DESKTOP_WINDOWS_DOWNLOAD_URL,
  'WorkRank Tracker-Portable-1.0.0-x64.exe': process.env.DESKTOP_WINDOWS_PORTABLE_DOWNLOAD_URL,
};

function desktopDownloadPath(fileName) {
  if (!DOWNLOADABLE_DESKTOP_FILES.has(fileName)) return null;
  const configuredDir = process.env.DESKTOP_DOWNLOAD_DIR;
  let downloadDir = path.resolve(__dirname, '../../desktop-app/release');
  if (configuredDir) {
    downloadDir = path.isAbsolute(configuredDir) ? configuredDir : path.resolve(process.cwd(), configuredDir);
    if (!fs.existsSync(downloadDir)) {
      downloadDir = path.resolve(__dirname, '../..', configuredDir);
    }
  }
  return path.join(downloadDir, fileName);
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https:', 'wss:'],
    },
  },
}));
app.use(morgan('combined', { skip: (req) => req.path === '/api/health' }));
app.use(cors(corsOptions));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use('/api/auth', authLimiter);
app.use('/api/activity', activityLimiter);
app.use('/api', apiLimiter);
app.use('/api', routes);
app.get('/downloads/:fileName', (req, res) => {
  const filePath = desktopDownloadPath(req.params.fileName);
  if (!filePath || !fs.existsSync(filePath)) {
    const redirectUrl = DESKTOP_DOWNLOAD_REDIRECTS[req.params.fileName];
    if (redirectUrl) return res.redirect(302, redirectUrl);
    return res.status(404).json({ message: 'Desktop installer not found' });
  }
  return res.download(filePath, req.params.fileName);
});

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
