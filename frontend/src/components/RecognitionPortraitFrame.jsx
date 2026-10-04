import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RecognitionPortrait } from './PublicRecognition';
import { users as usersApi } from '../services/api';

export default function RecognitionPortraitFrame({ type, record, loading }) {
  const frameRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState('pending');
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [clientGallery, setClientGallery] = useState([]);

  const isChampion = type === 'champion';
  const isMvp = type === 'mvp';

  // Champion: filter team members with avatar
  const members = useMemo(() => {
    return isChampion && Array.isArray(record?.members)
      ? record.members.filter((member) => member.name && (member.avatarData || member.avatarUrl))
      : [];
  }, [isChampion, record?.members]);

  // Fallback: If MVP record does not have galleryImages yet, fetch user's 6 gallery photos
  useEffect(() => {
    if (!isMvp || !record?.userId || (Array.isArray(record?.galleryImages) && record.galleryImages.length > 0)) {
      return;
    }
    let active = true;
    usersApi.gallery(record.userId).then((res) => {
      if (!active) return;
      const list = (res?.data || []).map((x) => x?.imageData).filter(Boolean);
      if (list.length > 0) setClientGallery(list);
    }).catch(() => {});
    return () => { active = false; };
  }, [isMvp, record?.userId, record?.galleryImages]);

  // Build slides for rotation
  const slides = useMemo(() => {
    if (isChampion) {
      if (members.length > 0) {
        return members.map((m) => ({
          name: m.name,
          image: m.avatarData || m.avatarUrl,
          portraitType: 'member',
        }));
      }
      return [{
        name: record?.teamName || 'Đội nhóm',
        image: record?.avatarUrl || null,
        portraitType: 'champion',
      }];
    }

    if (isMvp) {
      const photos = [];
      const mainImg = record?.avatarData || record?.avatarUrl;
      if (mainImg) photos.push(mainImg);

      // Collect 6 secondary gallery photos
      const gallerySource = Array.isArray(record?.galleryImages) && record.galleryImages.length > 0
        ? record.galleryImages
        : Array.isArray(record?.images) && record.images.length > 0
        ? record.images
        : clientGallery;

      gallerySource.forEach((item) => {
        const src = typeof item === 'string' ? item : item?.imageData || item?.url;
        if (src && !photos.includes(src)) {
          photos.push(src);
        }
      });

      if (photos.length > 0) {
        return photos.map((img) => ({
          name: record?.name || 'Cá nhân MVP',
          image: img,
          portraitType: 'mvp',
        }));
      }
      return [{
        name: record?.name || 'Cá nhân MVP',
        image: null,
        portraitType: 'mvp',
      }];
    }

    return [{
      name: record?.name || record?.teamName || '',
      image: record?.avatarData || record?.avatarUrl || null,
      portraitType: type,
    }];
  }, [isChampion, isMvp, members, record, clientGallery, type]);

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
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.2 });
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
    if (!loading && visible) setPhase((current) => reducedMotion ? 'open' : current === 'pending' ? 'opening' : current);
  }, [loading, visible, reducedMotion]);

  useEffect(() => {
    if (phase !== 'open' || !visible || paused || reducedMotion || !rotationEnabled) return;
    const timer = window.setTimeout(() => setPhase('closing'), 2000);
    return () => window.clearTimeout(timer);
  }, [phase, visible, paused, reducedMotion, rotationEnabled]);

  // Fallback safety timer: in case CSS animationend is delayed or throttled
  useEffect(() => {
    if (phase !== 'closing') return;
    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % slides.length);
      setPhase('opening');
    }, 650);
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

  return <>
    <div ref={frameRef} className={`public-featured-frame ${phase === 'pending' ? 'is-pending' : phase === 'closing' ? 'is-shutting' : 'is-ready'}`} onAnimationEnd={handleAnimationEnd}>
      <svg className="public-frame-quote is-opening" viewBox="0 0 100 175" aria-hidden="true" focusable="false"><path d="M0 0H100V100L52 175H0L48 100H0Z" /></svg>
      <svg className="public-frame-quote is-closing" viewBox="0 0 100 175" aria-hidden="true" focusable="false"><path d="M0 0H100V100L52 175H0L48 100H0Z" /></svg>
      <RecognitionPortrait name={slide.name} image={slide.image} type={slide.portraitType || type} imageOnly />
    </div>
    {rotationEnabled && !reducedMotion && (
      <button className="public-portrait-pause" type="button" aria-pressed={paused} onClick={() => setPaused((current) => !current)}>
        {paused ? 'Tiếp tục hiệu ứng' : 'Tạm dừng hiệu ứng'}
      </button>
    )}
  </>;
}
