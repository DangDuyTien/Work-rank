const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repoAppDir = path.resolve(__dirname, '..');
const electronExe = path.join(repoAppDir, 'node_modules', 'electron', 'dist', 'electron.exe');
const protocol = 'workrank';
const classesKey = `HKCU\\Software\\Classes\\${protocol}`;

function quote(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function regAdd(args) {
  execFileSync('reg.exe', ['add', ...args], { stdio: 'inherit' });
}

if (process.platform !== 'win32') {
  console.log('install-protocol:win chỉ dùng cho Windows.');
  process.exit(0);
}

if (!fs.existsSync(electronExe)) {
  throw new Error(`Không tìm thấy Electron executable: ${electronExe}. Hãy chạy "npm install" trong desktop-app trước.`);
}

const command = `${quote(electronExe)} ${quote(repoAppDir)} "%1"`;

regAdd([classesKey, '/ve', '/d', 'URL:WorkRank Tracker', '/f']);
regAdd([classesKey, '/v', 'URL Protocol', '/t', 'REG_SZ', '/d', '', '/f']);
regAdd([`${classesKey}\\DefaultIcon`, '/ve', '/d', `${electronExe},0`, '/f']);
regAdd([`${classesKey}\\shell`, '/ve', '/d', 'open', '/f']);
regAdd([`${classesKey}\\shell\\open\\command`, '/ve', '/d', command, '/f']);

console.log(`Đã cài protocol handler Windows: ${protocol}://`);
console.log(`Command: ${command}`);
