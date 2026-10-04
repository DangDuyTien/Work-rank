import React, { useEffect, useRef, useState } from 'react';
import { RecognitionPortrait } from './PublicRecognition';

export default function RecognitionPortraitFrame({ type, record, loading }) {
  const frameRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState('pending');
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const members = type === 'champion' && Array.isArray(record?.members)
    ? record.members.filter((member) => member.name && (member.avatarData || member.avatarUrl)) : [];
  const slides = members.length ? members.map((member) => ({ name: member.name, image: member.avatarData || member.avatarUrl }))
    : [{ name: type === 'mvp' ? record?.name : record?.teamName, image: type === 'mvp' ? record?.avatarData : record?.avatarUrl }];
  const slide = slides[index % slides.length];
  const rotationEnabled = type === 'champion';

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.2 });
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches || document.documentElement.dataset.workrankReduceMotion === 'true');
    const observer = new MutationObserver(update);
    update();
    media.addEventListener('change', update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-workrank-reduce-motion'] });
    return () => { media.removeEventListener('change', update); observer.disconnect(); };
  }, []);

  useEffect(() => {
    if (!loading && visible) setPhase((current) => reducedMotion ? 'open' : current === 'pending' ? 'opening' : current);
  }, [loading, visible, reducedMotion]);

  useEffect(() => {
    if (phase !== 'open' || !visible || paused || reducedMotion || !rotationEnabled) return;
    const timer = window.setTimeout(() => setPhase('closing'), 2000);
    return () => window.clearTimeout(timer);
  }, [phase, visible, paused, reducedMotion, rotationEnabled]);

  function handleAnimationEnd(event) {
    if (event.animationName === 'publicPortraitReveal') setPhase('open');
    if (event.animationName === 'publicQuoteCloseRight') {
      setIndex((current) => (current + 1) % slides.length);
      setPhase('opening');
    }
  }

  return <>
    <div ref={frameRef} className={`public-featured-frame ${phase === 'pending' ? 'is-pending' : phase === 'closing' ? 'is-shutting' : 'is-ready'}`} onAnimationEnd={handleAnimationEnd}>
      <svg className="public-frame-quote is-opening" viewBox="0 0 100 175" aria-hidden="true" focusable="false"><path d="M0 0H100V100L52 175H0L48 100H0Z" /></svg>
      <svg className="public-frame-quote is-closing" viewBox="0 0 100 175" aria-hidden="true" focusable="false"><path d="M0 0H100V100L52 175H0L48 100H0Z" /></svg>
      <RecognitionPortrait name={slide.name} image={slide.image} type={members.length ? 'member' : type} imageOnly />
    </div>
    {rotationEnabled && !reducedMotion && <button className="public-portrait-pause" type="button" aria-pressed={paused} onClick={() => setPaused((current) => !current)}>{paused ? 'Tiếp tục hiệu ứng' : 'Tạm dừng hiệu ứng'}</button>}
  </>;
}
