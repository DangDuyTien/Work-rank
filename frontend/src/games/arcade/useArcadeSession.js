import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { sameArcadeEvent } from '../../../../shared/arcade/engine.mjs';

export const arcadeApi = async (route, data) => (await (data === undefined ? api.get(`/api/games/arcade${route}`) : api.post(`/api/games/arcade${route}`, data))).data;
export const storageKey = (roomId, userId) => `wr:arcade:v1:${roomId}:${userId}`;

export function recoverEvents(snapshot, userId) {
  const saved = snapshot.players.find((p) => String(p.userId) === String(userId))?.events || [];
  try {
    const local = JSON.parse(sessionStorage.getItem(storageKey(snapshot.room.id, userId)) || '[]');
    if (Array.isArray(local) && local.length >= saved.length && saved.every((e, i) => sameArcadeEvent(e, local[i]))) return local;
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
  const inFlight = useRef(null), flushRef = useRef(null), draftTimer = useRef(null);
  const receive = useCallback((next) => {
    if (!next?.room || next.room.id !== roomId) return;
    const previous = snapshotRef.current;
    if (previous && next.room.revision < previous.room.revision) return;
    if (!previous) eventsRef.current = recoverEvents(next, userId);
    snapshotRef.current = next;
    offsetRef.current = next.serverNow - Date.now();
    setSnapshot(next); setOnline(true); setError('');
  }, [roomId, userId]);

  const persistDraft = useCallback(() => {
    clearTimeout(draftTimer.current); draftTimer.current = null;
    try { sessionStorage.setItem(storageKey(roomId,userId),JSON.stringify(eventsRef.current)); } catch { /* Server checkpoints remain authoritative. */ }
  },[roomId,userId]);

  useEffect(() => {
    if (!roomId) return;
    let alive = true;
    snapshotRef.current = null; setSnapshot(null); eventsRef.current = [];
    const poll = () => {
      if (inFlight.current) return inFlight.current;
      const request = async () => {
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
        return next;
      } catch (e) {
        if (alive) {
          setOnline(false);
          setError(e.response?.data?.message || 'Mất kết nối. Bạn vẫn chơi được; đang thử đồng bộ lại…');
        }
      return null;
      } finally { inFlight.current = null; }
      };
      inFlight.current = request();
      return inFlight.current;
    };
    flushRef.current = async () => { if (inFlight.current) await inFlight.current; return poll(); };
    poll();
    const timer = setInterval(poll, 1000);
    const state = (next) => { if (alive) receive(next); };
    socket?.on('arcade:state', state);
    return () => { alive = false; clearInterval(timer); socket?.off('arcade:state', state); flushRef.current=null; };
  }, [roomId, userId, socket, receive]);

  useEffect(() => {
    if (!roomId) return;
    let lastCheckpoint = 0;
    const checkpoint = () => {
      persistDraft();
      if (Date.now()-lastCheckpoint<500) return;
      lastCheckpoint=Date.now();
      const current=snapshotRef.current, player=current?.players.find(p=>String(p.userId)===String(userId));
      if (!current || current.room.id!==roomId || current.room.status!=='PLAYING' || player?.finishedAt) return;
      const elapsed=Date.now()+offsetRef.current-new Date(current.room.startedAt).getTime();
      if (elapsed<0) return;
      const body=JSON.stringify({attemptId:roomId,seed:current.room.seed,revision:eventsRef.current.length,events:eventsRef.current});
      // Browser keepalive has a 64KiB budget; normal deferred sync handles larger drafts.
      if (new Blob([body]).size>60000) return;
      const token=localStorage.getItem('token');
      fetch(`${api.defaults.baseURL || ''}/api/games/arcade/rooms/${roomId}/${elapsed>=current.room.durationSeconds*1000?'finish':'progress'}`,{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body,keepalive:true,credentials:'include',
      }).catch(()=>{});
    };
    const hidden=()=>{if(document.hidden)checkpoint();};
    window.addEventListener('pagehide',checkpoint);document.addEventListener('visibilitychange',hidden);
    return()=>{checkpoint();clearTimeout(draftTimer.current);window.removeEventListener('pagehide',checkpoint);document.removeEventListener('visibilitychange',hidden);};
  },[roomId,userId,persistDraft]);
  const record = useCallback((events) => {
    eventsRef.current = events;
    if (!draftTimer.current) draftTimer.current=setTimeout(persistDraft,1000);
  }, [persistDraft]);
  const action = async (verb, data = {}) => {
    try { if(verb==='leave' && snapshotRef.current?.room.status==='PLAYING' && !(await flushRef.current?.())) return null;
      const next = await arcadeApi(`/rooms/${roomId}/${verb}`, data); receive(next); return next; }
    catch (e) { setError(e.response?.data?.message || e.message); return null; }
  };
  return { snapshot, error, online, action, record, eventsRef, offsetRef };
}
