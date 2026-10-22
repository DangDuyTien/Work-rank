import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../services/api';

export const arcadeApi = async (route, data) => (await (data === undefined ? api.get(`/api/games/arcade${route}`) : api.post(`/api/games/arcade${route}`, data))).data;
export const storageKey = (roomId, userId) => `wr:arcade:v1:${roomId}:${userId}`;

export function recoverEvents(snapshot, userId) {
  const saved = snapshot.players.find((p) => String(p.userId) === String(userId))?.events || [];
  try {
    const local = JSON.parse(sessionStorage.getItem(storageKey(snapshot.room.id, userId)) || '[]');
    if (Array.isArray(local) && local.length >= saved.length && saved.every((e, i) => JSON.stringify(e) === JSON.stringify(local[i]))) return local;
  } catch { /* Storage may be disabled; server checkpoint remains usable. */ }
  return saved;
}

export default function useArcadeSession(roomId, userId, socket) {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(true);
  const eventsRef = useRef([]);
  const snapshotRef = useRef(null);
  const offsetRef = useRef(0);
  const inFlight = useRef(false);
  const receive = useCallback((next) => {
    if (!next?.room || next.room.id !== roomId) return;
    const previous = snapshotRef.current;
    if (previous && next.room.revision < previous.room.revision) return;
    if (!previous) eventsRef.current = recoverEvents(next, userId);
    snapshotRef.current = next;
    offsetRef.current = next.serverNow - Date.now();
    setSnapshot(next); setOnline(true); setError('');
  }, [roomId, userId]);

  useEffect(() => {
    if (!roomId) return;
    let alive = true;
    snapshotRef.current = null; setSnapshot(null); eventsRef.current = [];
    const poll = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        let current = snapshotRef.current;
        let next;
        const player = current?.players.find((p) => String(p.userId) === String(userId));
        if (current?.room.status === 'PLAYING' && !player?.finishedAt) {
          const room = current.room;
          const elapsed = Date.now() + offsetRef.current - new Date(room.startedAt).getTime();
          if (elapsed >= 0) {
            const payload = { attemptId: room.id, seed: room.seed, revision: eventsRef.current.length, events: eventsRef.current };
            next = await arcadeApi(`/rooms/${roomId}/${elapsed >= room.durationSeconds * 1000 ? 'finish' : 'progress'}`, payload);
          }
        }
        if (!next) next = await arcadeApi(`/rooms/${roomId}`);
        if (alive) receive(next);
      } catch (e) {
        if (alive) {
          setOnline(false);
          setError(e.response?.data?.message || 'Mất kết nối. Bạn vẫn chơi được; đang thử đồng bộ lại…');
        }
      } finally { inFlight.current = false; }
    };
    poll();
    const timer = setInterval(poll, 1000);
    const state = (next) => { if (alive) receive(next); };
    socket?.on('arcade:state', state);
    return () => { alive = false; clearInterval(timer); socket?.off('arcade:state', state); };
  }, [roomId, userId, socket, receive]);

  const record = useCallback((events) => {
    eventsRef.current = events;
    try { sessionStorage.setItem(storageKey(roomId, userId), JSON.stringify(events)); } catch { /* Keep input usable when storage is full. */ }
  }, [roomId, userId]);
  const action = async (verb, data = {}) => {
    try { const next = await arcadeApi(`/rooms/${roomId}/${verb}`, data); receive(next); return next; }
    catch (e) { setError(e.response?.data?.message || e.message); return null; }
  };
  return { snapshot, error, online, action, record, eventsRef, offsetRef };
}
