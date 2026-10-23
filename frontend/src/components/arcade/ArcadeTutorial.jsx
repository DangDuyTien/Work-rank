import React, { useEffect, useState } from 'react';
import { AnimatedCollapse } from '../ui';

const LESSONS = {
  computer_rush: { title: 'Thấy từ → gõ đúng → nối chuỗi', steps: ['Nhìn từ', 'Gõ ngay', 'Đúng rồi!'], tip: 'Aa và aa đều đúng. Giữ dấu tiếng Việt; Backspace để sửa.' },
  direction_rush: { title: 'Nhìn HƯỚNG → bấm thật nhanh', steps: ['Nhìn ↑', 'Bấm ↑ / W', 'Lướt đúng!'], tip: 'Hướng rõ ở trước, lớp sau chỉ gợi nhịp. Bỏ qua vị trí/màu; chỉ bấm ngược khi có biển ĐẢO CHIỀU!' },
  memory_flash: { title: 'Nhớ vị trí → chờ tắt → chọn lại', steps: ['Nhớ ô sao', 'Chờ tắt', 'Chọn đúng ô'], tip: 'Thanh GHI NHỚ ngắn dần theo nấc; sau khi bảng tắt bạn chỉ có vài giây để chọn. Bấm lại để bỏ chọn. Khi sai, xem ✓ chọn đúng · × chọn nhầm · ◇ bỏ sót.' },
};
export default function ArcadeTutorial({ gameType }) {
  const key = `wr:arcade:learned:v2:${gameType}`;
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(key) !== '1'; } catch { return true; } });
  const [step, setStep] = useState(0);
  const lesson = LESSONS[gameType];
  useEffect(() => {
    if (!open || window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.workrankReduceMotion === 'true') return;
    const timer = setInterval(() => { if (!document.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && document.documentElement.dataset.workrankReduceMotion !== 'true') setStep((s) => (s + 1) % 3); }, 1000);
    return () => clearInterval(timer);
  }, [open]);
  const dismiss = () => { try { localStorage.setItem(key, '1'); } catch { /* Still dismiss when storage is unavailable. */ } setOpen(false); };
  return <section className="arcade-tutorial" aria-label="Cách chơi trong ba bước">
    <button type="button" className="arcade-tutorial-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}><b>✦ {lesson.title}</b><span>{open ? 'Thu gọn' : 'Xem cách chơi'}</span></button>
    <AnimatedCollapse isOpen={open}><div className="arcade-tutorial-content" inert={!open ? '' : undefined}>
      <div className="arcade-tutorial-demo" data-step={step} aria-hidden="true">
        {gameType === 'computer_rush' ? <><span className="arcade-demo-word">WORK</span><span>→</span><kbd>{step === 0 ? '▏' : step === 1 ? 'WO▏' : 'WORK ✓'}</kbd></>
          : gameType === 'direction_rush' ? <><span className="arcade-demo-arrow">↑</span><span>→</span><kbd>↑ / W</kbd><span className={step === 2 ? 'arcade-demo-celebrate' : ''}>•ᴗ•</span></>
            : <div className="arcade-demo-memory">{Array.from({ length: 9 }, (_, i) => <i key={i} className={step !== 1 && [1, 5].includes(i) ? 'is-on' : ''}>{step === 0 && [1, 5].includes(i) ? '✦' : step === 2 && [1, 5].includes(i) ? '✓' : '·'}</i>)}</div>}
      </div>
      <div className="arcade-tutorial-steps">{lesson.steps.map((text, i) => <span key={text} className={step === i ? 'active' : ''}>{i + 1}. {text}</span>)}</div>
      <p>{lesson.tip}</p><button type="button" className="arcade-tutorial-done" onClick={dismiss}>Đã hiểu · sẵn sàng chơi ✓</button>
    </div></AnimatedCollapse>
  </section>;
}
