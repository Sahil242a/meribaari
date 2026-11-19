import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, minutes, timeOf } from '../lib/api.js';
import { getSocket, useClinicQueue } from '../lib/realtime.js';
import { getToken } from '../lib/myTokens.js';
import { chime } from '../lib/sound.js';
import { Brand, LivePill, SegBar } from '../components/ui.jsx';

const OVER = {
  done: 'Visit complete. Dhanyavaad!',
  no_show: 'Aapki baari nikal gayi',
  cancelled: 'Token cancel ho gaya',
};

export default function TokenPage() {
  const { id } = useParams();
  const [view, setView] = useState(null);
  const [error, setError] = useState(null);
  const [alert, setAlert] = useState(null);
  const [notifPerm, setNotifPerm] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const mine = getToken(id);

  const load = useCallback(() => api(`/tokens/${id}`).then(setView).catch(setError), [id]);
  useEffect(() => {
    load();
  }, [load]);

  // live: whenever the clinic queue moves, refresh this token's position
  const slug = view?.queue?.clinic?.slug;
  const { state: live, connected } = useClinicQueue(slug);
  useEffect(() => {
    if (live?.updatedAt && slug) load();
  }, [live?.updatedAt, slug, load]);

  // personal alerts pushed to this token's room
  useEffect(() => {
    const s = getSocket();
    const join = () => s.emit('join:token', id);
    if (s.connected) join();
    s.on('connect', join);
    const onAlert = ({ kind, message }) => {
      if (kind === 'issued') return;
      setAlert({ kind, message });
      chime();
      navigator.vibrate?.(kind === 'called' ? [400, 150, 400, 150, 400] : [300]);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
        new Notification(kind === 'called' ? 'Aapki baari aa gayi!' : 'Aapki baari aane wali hai', { body: message });
      }
      load();
    };
    s.on('token:alert', onAlert);
    return () => {
      s.off('connect', join);
      s.off('token:alert', onAlert);
    };
  }, [id, load]);

  if (error) {
    return (
      <div className="phone pad stack" style={{ paddingTop: 20 }}>
        <Brand />
        <h2>Token nahi mila</h2>
        <Link className="btn" to="/">
          Home
        </Link>
      </div>
    );
  }
  if (!view)
    return (
      <div className="phone pad muted" style={{ paddingTop: 20 }}>
        Loading...
      </div>
    );

  const { token, queue } = view;
  const clinic = queue.clinic;
  const called = token.status === 'serving';
  const over = token.status in OVER || !token.isToday;
  const waiting = !called && !over;
  const ahead = token.position != null ? token.position - 1 : null;
  const near = token.position != null && token.position <= 3;
  const startedAt = Math.max(mine?.startPosition || 0, token.position || 0, 1);
  const aheadTokens = queue.waiting.filter((w) => w.position < (token.position ?? 0)).map((w) => w.number);

  const cancel = async () => {
    if (!confirm('Token cancel karna hai? Phir se line mein lagna padega.')) return;
    await api(`/tokens/${id}/cancel`, { method: 'POST', body: { accessKey: mine.accessKey } });
    load();
  };
  const askNotif = async () => setNotifPerm(await Notification.requestPermission());
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) navigator.share({ title: `Token ${token.number}`, url }).catch(() => {});
    else {
      await navigator.clipboard?.writeText(url);
      setAlert({ kind: 'info', message: 'Link copy ho gaya' });
    }
  };

  return (
    <div className="phone">
      <header className={`app-head${called ? ' called' : over ? ' over' : ''}`} aria-live="polite">
        <div className="spread">
          <Brand light={!called} />
          <LivePill connected={connected} />
        </div>
        <p className="meta" style={{ marginTop: 18 }}>
          {clinic.name}
          {mine?.name ? `, ${mine.name}` : ''}
        </p>
        <div className="head-token" style={{ marginTop: 6 }}>
          <div>
            <div className="meta">{called ? 'Aapki baari aa gayi!' : 'Aapka token'}</div>
            <div className="num big">{token.number}</div>
          </div>
          <div className="side">
            {waiting && (
              <>
                <div className="meta">Wait</div>
                <div className="num">{minutes(token.etaMin)}</div>
              </>
            )}
            {called && (
              <>
                <div className="meta">Jaiye</div>
                <div className="num">{token.counterName}</div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="pad stack" style={{ marginTop: 16 }}>
        {called && (
          <div className="card called-burst">
            <span className="pill pill-lime">Abhi</span>
            <p className="num">{token.counterName} pe aaiye</p>
            <p className="muted small" style={{ marginTop: 8 }}>
              Reception pe apna token number batayein.
            </p>
          </div>
        )}

        {over && (
          <div className="card stack">
            <h3>{token.isToday ? OVER[token.status] : 'Ye token purane din ka hai'}</h3>
            {token.isToday && (
              <Link className="btn btn-primary" to={`/c/${clinic.slug}`}>
                Naya token lo
              </Link>
            )}
          </div>
        )}

        {alert && !called && (
          <div className="notice notice-warn" role="alert">
            {alert.kind === 'near' ? 'Aapki baari aane wali hai. Ab clinic aa jaiye.' : alert.message}
          </div>
        )}

        {waiting && (
          <>
            {near && !alert && <p className="notice notice-warn">Aapki baari aane wali hai. Ab clinic aa jaiye.</p>}
            {!near && (
              <div className="relax">
                <strong>Abhi aane ki zarurat nahi.</strong>
                <span className="small muted">
                  Jab baari aaye, tabhi aayein. Aapki baari se 3 number pehle SMS aur alert aa jayega.
                </span>
              </div>
            )}
            {clinic.paused && <p className="notice notice-warn">{clinic.pauseMessage}. Time thoda badh sakta hai.</p>}

            <div className="counter-list">
              {queue.serving.map((s) => (
                <div className="counter-row" key={s.counterId}>
                  <span className="small muted">{s.counter}</span>
                  <span className="num">{s.number || '--'}</span>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="spread">
                <span style={{ fontWeight: 700 }}>{ahead === 0 ? 'Aap sabse aage ho' : `${ahead} log aage`}</span>
                <span className="small muted">Line mein #{token.position}</span>
              </div>
              <SegBar total={startedAt} position={token.position} />
              <div className="ahead-tokens" aria-label="Tokens ahead of you">
                {aheadTokens.slice(-6).map((t) => (
                  <span key={t}>{t}</span>
                ))}
                <span className="you">{token.number}</span>
              </div>
              <p className="small muted" style={{ marginTop: 12 }}>
                Liya {timeOf(token.issuedAt)}. Andaaza aaj ke {queue.avgServiceMin} min per patient ke hisaab se.
              </p>
            </div>

            <p className="small muted">Ye page band kar sakte hain. Link save hai, kabhi bhi wapas khol lijiye.</p>
            <div className="row">
              <button className="btn" onClick={share}>
                Link share karo
              </button>
              {mine?.accessKey && (
                <button className="btn btn-danger" onClick={cancel}>
                  Cancel karo
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {waiting && notifPerm === 'default' && (
        <div className="dock">
          <div>
            <button className="btn btn-primary btn-block" onClick={askNotif}>
              Alerts on karo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
