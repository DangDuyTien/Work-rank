const http = require('http');

const HOST = 'http://localhost:3001';

let keystrokes = 0;
let clicks = 0;
let activeSeconds = 0;

console.log('');
console.log('╔══════════════════════════════════════╗');
console.log('║     WorkRank Realtime Tracker        ║');
console.log('╠══════════════════════════════════════╣');
console.log('║  Tự động track mọi hoạt động của bạn ║');
console.log('║  Chỉ đếm số lượng, KHÔNG ghi nội dung║');
console.log('║  Nhấn Ctrl+C để dừng                ║');
console.log('╚══════════════════════════════════════╝');
console.log('');

const totalElapsed = { keystrokes: 0, clicks: 0 };

setInterval(() => {
  const now = Date.now();
  const data = {
    keystrokes: keystrokes,
    mouse_clicks: clicks,
    active_seconds: activeSeconds + 5,
    idle_seconds: 0,
    user_id: 1,
  };

  const body = JSON.stringify(data);
  const req = http.request(`${HOST}/api/activity/ping`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, (res) => {
    let chunks = '';
    res.on('data', (c) => chunks += c);
    res.on('end', () => {
      try {
        const result = JSON.parse(chunks);
        totalElapsed.keystrokes += keystrokes;
        totalElapsed.clicks += clicks;
        if (keystrokes > 0 || clicks > 0) {
          process.stdout.write(`\r  Tổng hôm nay: Keys=${result.keystrokes} | Clicks=${result.mouse_clicks} | Score=${result.score}     `);
        } else {
          process.stdout.write(`\r  Đang chờ hoạt động...                                  `);
        }
      } catch {}
    });
  });
  req.on('error', () => process.stdout.write('\r  Lỗi kết nối server...     '));
  req.write(body);
  req.end();

  keystrokes = 0;
  clicks = 0;
  activeSeconds = 0;
}, 3000);

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', (key) => {
  if (key === '\u0003') process.exit(0);
  keystrokes++;
});
