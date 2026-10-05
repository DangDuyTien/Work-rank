import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RecognitionPortrait, removeVietnameseDiacritics } from './PublicRecognition';

export default function RecognitionPortraitFrame({ type, record, loading }) {
  const frameRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState('pending');
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  const isChampion = type === 'champion';
  const isMvp = type === 'mvp';

  // Champion: filter team members with avatar
  const members = useMemo(() => {
    return isChampion && Array.isArray(record?.members)
      ? record.members.filter((member) => member.name && (member.avatarData || member.avatarUrl))
      : [];
  }, [isChampion, record?.members]);

  // Build slides for rotation
  const slides = useMemo(() => {
    if (isChampion) {
      if (members.length > 0) {
        return members.map((m) => ({
          name: removeVietnameseDiacritics(m.name),
          image: m.avatarData || m.avatarUrl,
          portraitType: 'member',
        }));
      }
      return [{
        name: removeVietnameseDiacritics(record?.teamName) || 'Doi nhom',
        image: record?.avatarUrl || null,
        portraitType: 'champion',
      }];
    }

    if (isMvp) {
      const photos = [];
      const mainImg = record?.avatarData || record?.avatarUrl;
      if (mainImg) photos.push(mainImg);

      // Public portraits only use photos supplied by the public spotlight DTO.
      const gallerySource = Array.isArray(record?.galleryImages) && record.galleryImages.length > 0
        ? record.galleryImages
        : Array.isArray(record?.images) && record.images.length > 0
        ? record.images
        : [];

      gallerySource.forEach((item) => {
        const src = typeof item === 'string' ? item : item?.imageData || item?.url;
        if (src && !photos.includes(src)) {
          photos.push(src);
        }
      });

      if (photos.length > 0) {
        return photos.map((img) => ({
          name: removeVietnameseDiacritics(record?.name) || 'Ca nhan MVP',
          image: img,
          portraitType: 'mvp',
        }));
      }
      return [{
        name: removeVietnameseDiacritics(record?.name) || 'Ca nhan MVP',
        image: null,
        portraitType: 'mvp',
      }];
    }

    return [{
      name: removeVietnameseDiacritics(record?.name || record?.teamName) || '',
      image: record?.avatarData || record?.avatarUrl || null,
      portraitType: type,
    }];
  }, [isChampion, isMvp, members, record, type]);

  const slide = slides[index % slides.length] || { name: '', image: null, portraitType: type };
  // Enable 2-second rotation whenever there are multiple photos
  const rotationEnabled = slides.length > 1;

  // Preload all slides in advance to ensure instantaneous, flicker-free image rendering
  useEffect(() => {
    slides.forEach((s) => {
      if (s.image && typeof s.image === 'string') {
        const img = new Image();
        img.src = s.image;
      }
    });
  }, [slides]);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
      }
    }, {
      threshold: 0.05,
      rootMargin: '120px 0px 120px 0px',
    });
    if (frameRef.current) observer.observe(frameRef.current);
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
    if (!loading && visible && phase === 'pending') {
      setPhase(reducedMotion ? 'open' : 'opening');
    }
  }, [loading, visible, reducedMotion, phase]);

  // Guaranteed transition from opening -> open (so it never gets stuck on opening)
  useEffect(() => {
    if (phase !== 'opening') return;
    const timer = window.setTimeout(() => setPhase('open'), 720);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // 3-second display interval between photo changes
  useEffect(() => {
    if (phase !== 'open' || !visible || reducedMotion || !rotationEnabled) return;
    const timer = window.setTimeout(() => setPhase('closing'), 3000);
    return () => window.clearTimeout(timer);
  }, [phase, visible, reducedMotion, rotationEnabled]);

  // Guaranteed transition from closing -> next slide opening
  useEffect(() => {
    if (phase !== 'closing') return;
    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % slides.length);
      setPhase('opening');
    }, 550);
    return () => window.clearTimeout(timer);
  }, [phase, slides.length]);

  function handleAnimationEnd(event) {
    if (event.animationName === 'publicPortraitReveal') {
      setPhase('open');
    }
    if (event.animationName === 'publicQuoteCloseRight') {
      setIndex((current) => (current + 1) % slides.length);
      setPhase('opening');
    }
  }

  function handleFrameClick() {
    if (!rotationEnabled || phase !== 'open') return;
    setPhase('closing');
  }

  return (
    <div
      ref={frameRef}
      className={`public-featured-frame ${phase === 'pending' ? 'is-pending' : phase === 'closing' ? 'is-shutting' : 'is-ready'} ${rotationEnabled ? 'is-interactive' : ''}`}
      onAnimationEnd={handleAnimationEnd}
      onClick={handleFrameClick}
      title={rotationEnabled ? 'Nhấn để chuyển sang ảnh tiếp theo' : undefined}
    >
      <svg className="public-frame-quote is-opening" viewBox="0 0 100 175" aria-hidden="true" focusable="false"><path d="M0 0H100V100L52 175H0L48 100H0Z" /></svg>
      <svg className="public-frame-quote is-closing" viewBox="0 0 100 175" aria-hidden="true" focusable="false"><path d="M0 0H100V100L52 175H0L48 100H0Z" /></svg>
      <RecognitionPortrait name={slide.name} image={slide.image} type={slide.portraitType || type} imageOnly />
    </div>
  );
}
