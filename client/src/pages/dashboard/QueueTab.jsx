import { useCallback, useEffect, useState } from 'react';
import { api, minutes, timeOf } from '../../lib/api.js';
import { getSocket } from '../../lib/realtime.js';

const STATUS_LABEL = { done: 'Done', no_show: 'Nahi aaye', cancelled: 'Cancelled' };

function useStaffQueue() {
  const [q, setQ] = useState(null);
  const load = useCallback(() => api('/staff/queue').then(setQ), []);

  useEffect(() => {
    load();
    const s = getSocket();
    const join = () => s.emit('join:staff');
    if (s.connected) join();
    s.on('connect', join);
    s.on('staff:update', load);
    const poll = setInterval(load, 30000); // keeps ETAs fresh even when nothing happens
    return () => {
      s.off('connect', join);
      s.off('staff:update', load);
      clearInterval(poll);
    };
  }, [load]);

  return [q, setQ, load];
}

function Elapsed({ since }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!since) return null;
  const s = Math.max(0, Math.floor((now - new Date(since)) / 1000));
  return (
    <span>
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
    </span>
  );
}

export default function QueueTab() {
  const [q, setQ, load] = useStaffQueue();
  const [counterId, setCounterId] = useState(() => localStorage.getItem('mb_counter') || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [walkIn, setWalkIn] = useState({ name: '', phone: '', priority: false });
  const [pauseMsg, setPauseMsg] = useState('');

  const counters = q?.clinic.counters || [];
  const activeCounter = counters.find((c) => c.id === counterId) || counters[0];
  const activeId = activeCounter?.id;
  const current = q?.servingDetail.find((t) => t.counterId === activeId);

  const act = useCallback(
    async (path, body = {}) => {
      setBusy(true);
      setMsg(null);
      try {
        setQ(await api(path, { method: 'POST', body: { counterId: activeId, ...body } }));
      } catch (e) {
        setMsg(e.message);
      } finally {
        setBusy(false);
      }
    },
    [activeId, setQ]
  );

  // keyboard: N = call next
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, select, textarea')) return;
      if (e.key === 'n' || e.key === 'N') act('/staff/queue/next');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act]);

  if (!q) return <p className="muted">Loading queue...</p>;
  const { clinic } = q;

  const pickCounter = (id) => {
    setCounterId(id);
    localStorage.setItem('mb_counter', id);
  };

  const addWalkIn = async (e) => {
    e.preventDefault();
    if (!walkIn.name.trim()) return setMsg('Walk-in ka naam likhein');
    try {
      const t = await api('/staff/walk-in', { method: 'POST', body: walkIn });
      setWalkIn({ name: '', phone: '', priority: false });
      setMsg(`Token ${t.number} diya gaya`);
      load();
    } catch (ex) {
      setMsg(ex.message);
    }
  };

  return (
    <div className="qlayout">
      <aside className="stack" style={{ gap: 16 }}>
        <section className="serve-card" aria-label="Counter controls">
          {counters.length > 1 && (
            <div className="counter-tabs" role="group" aria-label="Aapka counter">
              {counters.map((c) => (
                <button key={c.id} aria-pressed={c.id === activeId} onClick={() => pickCounter(c.id)}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <div className="serve-now">
            <div className="spread meta">
              <span>{activeCounter?.name}: abhi andar</span>
              {current && (
                <span>
                  <Elapsed since={current.calledAt} />
                </span>
              )}
            </div>
            <div className="num">{current?.number || '--'}</div>
            {current ? (
              <div>
                <div style={{ fontWeight: 700 }}>{current.name}</div>
                <div className="meta">{current.phone || 'Mobile nahi diya'}</div>
              </div>
            ) : (
              <div className="meta">Koi andar nahi hai</div>
            )}
          </div>
          <button
            className="btn btn-lime btn-block"
            disabled={busy || clinic.paused}
            onClick={() => act('/staff/queue/next')}
          >
            Agla patient bulao{' '}
            <span className="kbd" style={{ background: 'rgba(11,61,44,.12)' }}>
              N
            </span>
          </button>
          <div className="serve-actions">
            <button className="btn" disabled={busy || !current} onClick={() => act('/staff/queue/complete')}>
              Complete
            </button>
            <button className="btn btn-danger" disabled={busy || !current} onClick={() => act('/staff/queue/no-show')}>
              Nahi aaye
            </button>
          </div>
          {msg && (
            <p className="notice notice-warn" role="status">
              {msg}
            </p>
          )}
        </section>

        <form className="card stack" style={{ gap: 12 }} onSubmit={addWalkIn}>
          <h3>Walk-in patient</h3>
          <input
            value={walkIn.name}
            onChange={(e) => setWalkIn({ ...walkIn, name: e.target.value })}
            placeholder="Naam"
            aria-label="Walk-in name"
          />
          <input
            value={walkIn.phone}
            onChange={(e) => setWalkIn({ ...walkIn, phone: e.target.value })}
            placeholder="Mobile (optional)"
            inputMode="tel"
            aria-label="Walk-in mobile"
          />
          <label className="check">
            <input
              type="checkbox"
              checked={walkIn.priority}
              onChange={(e) => setWalkIn({ ...walkIn, priority: e.target.checked })}
            />
            Senior citizen ya emergency (pehle bulao)
          </label>
          <button className="btn btn-primary">Token do</button>
        </form>

        <div className="card stack" style={{ gap: 12 }}>
          <h3>Break aur timing</h3>
          {clinic.paused ? (
            <>
              <p className="notice notice-warn">Paused: {clinic.pauseMessage}</p>
              <button className="btn" onClick={() => act('/staff/pause', { paused: false })}>
                Queue resume karo
              </button>
            </>
          ) : (
            <>
              <input
                value={pauseMsg}
                onChange={(e) => setPauseMsg(e.target.value)}
                placeholder="Doctor lunch pe hain, 2 baje wapas"
                aria-label="Break message"
              />
              <button className="btn" onClick={() => act('/staff/pause', { paused: true, message: pauseMsg })}>
                Break pe daalo
              </button>
            </>
          )}
          <label className="check">
            <input
              type="checkbox"
              checked={clinic.isOpen}
              onChange={(e) => act('/staff/open', { isOpen: e.target.checked })}
            />
            Naye tokens chalu hain
          </label>
        </div>
      </aside>

      <section className="stack" style={{ gap: 16 }}>
        <div className="stats">
          <div className="stat hl">
            <span className="small">Line mein</span>
            <span className="num">{q.waitingCount}</span>
          </div>
          <div className="stat">
            <span className="small muted">Avg consultation</span>
            <span className="num">{q.avgServiceMin} min</span>
          </div>
          <div className="stat">
            <span className="small muted">Aakhri token ka wait</span>
            <span className="num">{minutes(q.waiting.at(-1)?.etaMin ?? 0)}</span>
          </div>
        </div>

        <div className="list">
          <div className="list-head">
            <h3>Waiting</h3>
            <span className="small muted">Priority pehle, phir aane ke time se</span>
          </div>
          {q.waitingDetail.length === 0 ? (
            <p className="empty">
              Line khaali hai. Walk-in token do, ya QR poster lagao taaki patients khud token lein.
            </p>
          ) : (
            q.waitingDetail.map((t) => (
              <div className="li" key={t.id}>
                <span className="pos">{t.position}</span>
                <span className="tok">{t.number}</span>
                <div>
                  <div className="row" style={{ gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>{t.name}</span>
                    {t.priority && <span className="pill pill-red">Priority</span>}
                    {t.source === 'walk_in' && <span className="pill pill-amber">Walk-in</span>}
                  </div>
                  <div className="sub">
                    {t.phone || 'No mobile'}, aaye {timeOf(t.issuedAt)}
                  </div>
                </div>
                <span className="eta">{minutes(t.etaMin)}</span>
              </div>
            ))
          )}
        </div>

        <div className="list">
          <div className="list-head">
            <h3>Abhi abhi</h3>
          </div>
          {q.recent.length === 0 ? (
            <p className="empty">Aaj abhi tak koi patient complete nahi hua.</p>
          ) : (
            q.recent.slice(0, 6).map((t) => (
              <div className="li" key={t.id} style={{ gridTemplateColumns: '64px 76px 1fr auto' }}>
                <span className={`pill ${t.status === 'done' ? '' : 'pill-red'}`} style={{ justifySelf: 'start' }}>
                  {t.status === 'done' ? 'Done' : 'Miss'}
                </span>
                <span className="tok">{t.number}</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  <div className="sub">
                    {STATUS_LABEL[t.status]}, {timeOf(t.completedAt)}
                  </div>
                </div>
                {t.status !== 'done' ? (
                  <button className="btn btn-sm" onClick={() => act(`/staff/tokens/${t.id}/requeue`)}>
                    Wapas line mein
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
