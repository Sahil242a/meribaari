import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from './api.js';

let socket;
/** One shared connection for the whole app. */
export function getSocket() {
  if (!socket) socket = io({ withCredentials: true, transports: ['websocket', 'polling'] });
  return socket;
}

/**
 * Public queue state for a clinic (by slug), kept live over Socket.io.
 * Re-fetches on reconnect so a phone waking from sleep is never stale.
 */
export function useClinicQueue(slug) {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const clinicId = state?.clinic?.id;
  const lastEvent = useRef(null);

  useEffect(() => {
    if (!slug) return;
    let alive = true;
    api(`/clinics/${slug}`)
      .then((s) => alive && setState(s))
      .catch((e) => alive && setError(e));
    return () => {
      alive = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!clinicId) return;
    const s = getSocket();
    const join = () => {
      setConnected(true);
      s.emit('join:clinic', clinicId);
      api(`/clinics/${slug}`)
        .then(setState)
        .catch(() => {});
    };
    const onUpdate = (payload) => {
      if (payload.clinic.id !== clinicId) return;
      lastEvent.current = payload.event;
      setState(payload);
    };
    const onDisconnect = () => setConnected(false);
    if (s.connected) join();
    s.on('connect', join);
    s.on('disconnect', onDisconnect);
    s.on('queue:update', onUpdate);
    return () => {
      s.off('connect', join);
      s.off('disconnect', onDisconnect);
      s.off('queue:update', onUpdate);
    };
  }, [clinicId, slug]);

  return { state, error, connected };
}
