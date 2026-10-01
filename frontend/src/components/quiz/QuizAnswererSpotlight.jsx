import React, { useState, useEffect, useRef } from 'react';
import QuizAvatar from './QuizAvatar';
import { Zap, CheckCircle } from 'lucide-react';
import quizSound from './quizSound';

/**
 * QuizAnswererSpotlight - Center-Stage Spotlight Animation for Live Quiz
 *
 * Smoothly animates any player who locks in their answer:
 * opacity 0, scale 0.75, translateY(25px) -> opacity 1, scale 1.05, translateY(0) -> scale 1
 * -> settle / drift down & fade out (~800-1100ms total).
 *
 * Uses an internal queue to prevent chaotic overlapping when multiple players
 * answer within milliseconds of each other.
 */
export default function QuizAnswererSpotlight({
  incomingEvent = null,
  currentUserId = null,
}) {
  const [activeItem, setActiveItem] = useState(null);
  const [animationState, setAnimationState] = useState('hidden'); // 'entering' | 'active' | 'exiting' | 'hidden'
  const queueRef = useRef([]);
  const isProcessingRef = useRef(false);
  const timerRef = useRef(null);

  // When new answer event arrives, push into queue and process
  useEffect(() => {
    if (!incomingEvent || !incomingEvent.userId) return;

    const eventId = `${incomingEvent.userId}_${incomingEvent.answeredAt || Date.now()}_${Math.random()}`;
    queueRef.current.push({
      ...incomingEvent,
      id: eventId,
    });

    if (!isProcessingRef.current) {
      processNextInQueue();
    }
  }, [incomingEvent]);

  const processNextInQueue = () => {
    if (queueRef.current.length === 0) {
      isProcessingRef.current = false;
      setActiveItem(null);
      setAnimationState('hidden');
      return;
    }

    isProcessingRef.current = true;
    const nextItem = queueRef.current.shift();
    setActiveItem(nextItem);
    setAnimationState('entering');

    // Play subtle spotlight audio
    quizSound.playSpotlight();

    // Speed up if queue has backed-up players (> 2)
    const isBacklogged = queueRef.current.length > 1;
    const enterDuration = isBacklogged ? 180 : 260;
    const holdDuration = isBacklogged ? 260 : 420;
    const exitDuration = isBacklogged ? 180 : 280;

    // Transition entering -> active
    timerRef.current = setTimeout(() => {
      setAnimationState('active');

      // Transition active -> exiting
      timerRef.current = setTimeout(() => {
        setAnimationState('exiting');

        // Transition exiting -> next item in queue
        timerRef.current = setTimeout(() => {
          processNextInQueue();
        }, exitDuration);
      }, holdDuration);
    }, enterDuration);
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!activeItem || animationState === 'hidden') return null;

  const isMe = Number(activeItem.userId) === Number(currentUserId);
  const displayName = activeItem.userName || activeItem.user?.name || `Người chơi ${activeItem.userId}`;
  const displayUser = activeItem.user || { id: activeItem.userId, name: displayName, avatarUrl: activeItem.userAvatar };

  // Calculate dynamic transform & opacity styles based on state
  let transform = 'translate(-50%, -50%) scale(0.75) translateY(25px)';
  let opacity = 0;
  let transition = 'all 0.26s cubic-bezier(0.16, 1, 0.3, 1)';

  if (animationState === 'entering') {
    transform = 'translate(-50%, -50%) scale(1.05) translateY(0px)';
    opacity = 1;
    transition = 'all 0.26s cubic-bezier(0.16, 1, 0.3, 1)';
  } else if (animationState === 'active') {
    transform = 'translate(-50%, -50%) scale(1) translateY(0px)';
    opacity = 1;
    transition = 'all 0.2s ease-out';
  } else if (animationState === 'exiting') {
    transform = 'translate(-50%, -50%) scale(0.9) translateY(45px)';
    opacity = 0;
    transition = 'all 0.28s cubic-bezier(0.4, 0, 1, 1)';
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '46%',
        left: '50%',
        transform,
        opacity,
        transition,
        zIndex: 90,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.98)',
          border: isMe ? '1.5px solid rgba(180, 83, 9, 0.4)' : '1px solid rgba(0, 0, 0, 0.12)',
          borderRadius: 12,
          padding: '16px 28px',
          boxShadow: isMe
            ? '0 16px 40px rgba(180, 83, 9, 0.22), 0 2px 10px rgba(0, 0, 0, 0.08)'
            : '0 16px 40px rgba(0, 0, 0, 0.18), 0 2px 10px rgba(0, 0, 0, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          minWidth: 200,
          maxWidth: 320,
          backdropFilter: 'blur(10px)',
          textAlign: 'center',
        }}
      >
        {/* Avatar Ring */}
        <div
          style={{
            position: 'relative',
            padding: 3,
            borderRadius: '50%',
            background: isMe
              ? 'linear-gradient(135deg, #b45309, #f59e0b)'
              : 'linear-gradient(135deg, #141414, #666666)',
            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
          }}
        >
          <QuizAvatar
            user={displayUser}
            userId={activeItem.userId}
            size="lg"
            border="2px solid #ffffff"
          />
        </div>

        {/* Player Name */}
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: '#141414',
            maxWidth: 220,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '-0.2px',
          }}
        >
          {isMe ? 'Bạn' : displayName}
        </div>

        {/* Action Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 12px',
            borderRadius: 9999,
            background: isMe ? '#fffbeb' : '#f4f3ef',
            border: isMe ? '1px solid rgba(180, 83, 9, 0.3)' : '1px solid rgba(0, 0, 0, 0.1)',
            color: isMe ? '#b45309' : '#141414',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.4px',
            textTransform: 'uppercase',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          <Zap size={13} color={isMe ? '#b45309' : '#141414'} />
          <span>ĐÃ TRẢ LỜI</span>
        </div>
      </div>
    </div>
  );
}
