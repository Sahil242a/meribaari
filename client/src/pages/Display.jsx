import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useClinicQueue } from '../lib/realtime.js';
import { announce, chime, unlockAudio } from '../lib/sound.js';
import { minutes } from '../lib/api.js';
import { Brand, LivePill } from '../components/ui.jsx';

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  return <span className="clock">{now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>;
}

/** Waiting-room TV: big LED numbers, next tokens, bell + Hindi announcement. */
export default function Display() {
  const { slug } = useParams();
  const { state, error, connected } = useClinicQueue(slug);
  const [sound, setSound] = useState(null); // null = not chosen yet
  const [flash, setFlash] = useState({});
  const prev = useRef(null);

  useEffect(() => {
    if (!state) return;
    const current = Object.fromEntries(state.serving.map((s) => [s.counterId, s.number]));
    if (prev.current) {
      const changed = state.serving.filter((s) => s.number && prev.current[s.counterId] !== s.number);
      if (changed.length) {
        setFlash(Object.fromEntries(changed.map((c) => [c.counterId, Date.now()])));
        if (sound) {
          chime();
          changed.forEach((c) =>
            setTimeout(() => announce(`Token number ${c.number.replace('-', ' ')}, ${c.counter} pe aaiye`), 900)
          );
        }
      }
    }
    prev.current = current;
  }, [state, sound]);

  if (error)
    return (
      <div className="tv">
        <div className="tv-top">
          <p className="clinic">Clinic nahi mila</p>
        </div>
      </div>
    );
  if (!state) return <div className="tv" />;

  const { clinic, serving, waiting } = state;
  const joinUrl = `${window.location.origin}/c/${clinic.slug}`;

  return (
    <div className="tv">
      <header className="tv-top">
        <div>
          <p className="clinic">{clinic.name}</p>
          {clinic.department && <p className="meta">{clinic.department}</p>}
        </div>
        <div className="row" style={{ gap: 20 }}>
          <LivePill connected={connected} />
          <Clock />
        </div>
      </header>

      <main className="tv-main">
        <div className="tv-counters">
          {clinic.paused && <div className="tv-pause">{clinic.pauseMessage}</div>}
          {serving.map((s) => (
            <div
              key={`${s.counterId}-${flash[s.counterId] || 0}`}
              className={`tv-counter${flash[s.counterId] ? ' flash' : ''}`}
            >
              <div>
                <p className="label">Abhi andar</p>
                <p className="cname">{s.counter}</p>
              </div>
              <span className="big" style={serving.length > 1 ? { fontSize: 'clamp(4rem, 10vw, 9rem)' } : undefined}>
                {s.number || '--'}
              </span>
            </div>
          ))}
        </div>

        <aside className="tv-next">
          <h2>Agle tokens</h2>
          {waiting.length ? (
            <ol>
              {waiting.slice(0, 4).map((w, i) => (
                <li key={w.id}>
                  {w.number}
                  <span>{i === 0 ? 'Taiyaar rahiye' : w.etaMin < 1 ? 'Abhi' : `~${minutes(w.etaMin)}`}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p style={{ marginTop: '2vh', fontSize: '1.5rem', opacity: 0.85 }}>Koi line nahi hai</p>
          )}
          {waiting.length > 4 && (
            <p style={{ marginTop: '1.5vh', opacity: 0.85 }}>+{waiting.length - 4} aur line mein</p>
          )}
        </aside>
      </main>

      <footer className="tv-foot">
        <div className="row" style={{ gap: 18 }}>
          <div className="qr-box">
            <QRCodeSVG value={joinUrl} size={84} marginSize={0} title="Scan to join queue" />
          </div>
          <div>
            <p style={{ fontWeight: 800 }}>Token ke liye scan karo</p>
            <p className="muted">Jab Baari Aaye, Tabhi Aayein! Baari se pehle SMS milega.</p>
          </div>
        </div>
        <Brand />
      </footer>

      {sound === null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(11,61,44,0.94)',
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
          }}
        >
          <div className="stack" style={{ textAlign: 'center', maxWidth: 520 }}>
            <h2>TV display shuru karein</h2>
            <p style={{ color: '#cfe7dc' }}>
              Browser ko awaaz chalane ke liye ek click chahiye. Full screen ke liye F11 dabayein.
            </p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button
                className="btn btn-lime"
                onClick={() => {
                  unlockAudio();
                  setSound(true);
                  announce('MeriBaari display shuru');
                }}
              >
                Awaaz ke saath shuru karo
              </button>
              <button
                className="btn"
                style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.4)' }}
                onClick={() => setSound(false)}
              >
                Bina awaaz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
