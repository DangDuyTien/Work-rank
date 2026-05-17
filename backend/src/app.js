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
  const candidates = [];
  const configuredDir = process.env.DESKTOP_DOWNLOAD_DIR;
  if (configuredDir) {
    const primaryDir = path.isAbsolute(configuredDir) ? configuredDir : path.resolve(process.cwd(), configuredDir);
    candidates.push(path.join(primaryDir, fileName));
    candidates.push(path.join(path.resolve(__dirname, '../..', configuredDir), fileName));
  }
  candidates.push(
    path.resolve(__dirname, '../../desktop-app/release', fileName),
    path.resolve(__dirname, '../../frontend/dist/downloads', fileName),
    path.resolve(__dirname, '../../frontend/public/downloads', fileName),
  );
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function renderMissingDesktopInstaller(req, res) {
  const wantsJson = String(req.get('accept') || '').includes('application/json');
  const message = 'Desktop installer not found';
  const hint = 'Upload WorkRank Tracker installer to a public URL and set DESKTOP_WINDOWS_DOWNLOAD_URL on Render, or put the file in DESKTOP_DOWNLOAD_DIR.';
  if (wantsJson) return res.status(503).json({ message, hint });
  return res.status(503).type('html').send(`<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>WorkRank Tracker chưa sẵn sàng tải</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #0f172a; }
      main { max-width: 560px; margin: 12vh auto; padding: 28px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; box-shadow: 0 18px 50px rgba(15,23,42,.08); }
      h1 { margin: 0 0 10px; font-size: 24px; }
      p { color: #475569; line-height: 1.55; }
      code { background: #eef2ff; color: #1d4ed8; padding: 2px 6px; border-radius: 5px; }
      a { color: #2563eb; font-weight: 800; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <h1>Chưa có file cài WorkRank Tracker</h1>
      <p>Server đã nhận yêu cầu tải app Windows, nhưng chưa tìm thấy file installer và cũng chưa có link redirect.</p>
      <p>Admin cần upload file <code>WorkRank Tracker-Setup-1.0.0-x64.exe</code> lên GitHub Release/R2/S3, sau đó set biến môi trường <code>DESKTOP_WINDOWS_DOWNLOAD_URL</code> trên Render rồi redeploy.</p>
      <p><a href="/">Quay lại WorkRank</a></p>
    </main>
  </body>
</html>`);
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      scriptSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"],
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
    return renderMissingDesktopInstaller(req, res);
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
