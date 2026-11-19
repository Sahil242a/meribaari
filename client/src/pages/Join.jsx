import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, minutes } from '../lib/api.js';
import { useClinicQueue } from '../lib/realtime.js';
import { saveToken, todaysTokenFor } from '../lib/myTokens.js';
import { Brand, Field, LivePill } from '../components/ui.jsx';

function getCoords() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Is phone mein location support nahi hai'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(new Error('Location allow karein, tabhi token milega')),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

export default function Join() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { state, error, connected } = useClinicQueue(slug);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const existing = todaysTokenFor(slug);

  if (error) {
    return (
      <div className="phone pad stack" style={{ paddingTop: 20 }}>
        <Brand />
        <h2>Clinic nahi mila</h2>
        <p className="muted">QR code dobara scan karein ya reception se link maangein.</p>
      </div>
    );
  }
  if (!state)
    return (
      <div className="phone pad muted" style={{ paddingTop: 20 }}>
        Loading...
      </div>
    );

  const { clinic, waiting, waitingCount, avgServiceMin } = state;
  const lanes = Math.max(1, clinic.counters.length);
  const newcomerEta = waitingCount ? waiting[waiting.length - 1].etaMin + Math.round(avgServiceMin / lanes) : 0;
  const nowServing = state.serving.filter((s) => s.number);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (form.name.trim().length < 2) return setErr({ name: 'Apna naam likhein' });
    setBusy(true);
    try {
      const coords = clinic.needsLocation ? await getCoords() : undefined;
      const res = await api(`/clinics/${slug}/tokens`, { method: 'POST', body: { ...form, coords } });
      saveToken({
        id: res.token.id,
        accessKey: res.accessKey,
        number: res.token.number,
        name: form.name,
        slug,
        startPosition: res.token.position,
      });
      navigate(`/t/${res.token.id}`);
    } catch (ex) {
      const fieldErr = ex.fields?.find((f) => f.path === 'phone' || f.path === 'name');
      setErr(fieldErr ? { [fieldErr.path]: fieldErr.message } : { form: ex.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="phone">
      <header className="app-head">
        <div className="spread">
          <Brand light />
          <LivePill connected={connected} />
        </div>
        <h2 style={{ marginTop: 22 }}>{clinic.name}</h2>
        <p className="meta">{[clinic.department, clinic.address].filter(Boolean).join(', ')}</p>
        <div className="head-token" style={{ marginTop: 18 }}>
          <div>
            <div className="meta">Abhi andar</div>
            <div className="num" style={{ fontSize: '1.9rem' }}>
              {nowServing.length ? nowServing.map((s) => s.number).join(', ') : '--'}
            </div>
          </div>
          <div className="side">
            <div className="meta">{waitingCount} log line mein</div>
            <div className="num">~{minutes(newcomerEta)}</div>
          </div>
        </div>
      </header>

      <div className="pad stack" style={{ marginTop: 16 }}>
        {!clinic.isOpen && <p className="notice notice-bad">Clinic ne aaj ke tokens band kar diye hain.</p>}
        {clinic.paused && <p className="notice notice-warn">{clinic.pauseMessage}. Token le sakte hain.</p>}

        {existing && (
          <div className="notice notice-ok spread">
            <span>Aapka token {existing.number} pehle se hai</span>
            <Link className="btn btn-sm btn-primary" to={`/t/${existing.id}`}>
              Token dekho
            </Link>
          </div>
        )}

        {clinic.isOpen && (
          <form id="join-form" className="card stack" onSubmit={submit} noValidate>
            <div>
              <h3>Token lijiye</h3>
              <p className="small muted">
                Jab baari aaye, tabhi aayein. Token lo aur apna kaam karo, baari se pehle SMS aa jayega.
              </p>
            </div>
            <Field label="Aapka naam" error={err?.name}>
              <input
                value={form.name}
                autoComplete="name"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ramesh Kumar"
              />
            </Field>
            <Field label="Mobile number" hint="(SMS ke liye, optional)" error={err?.phone}>
              <input
                value={form.phone}
                inputMode="tel"
                autoComplete="tel"
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="98765 43210"
              />
            </Field>
            {clinic.needsLocation && (
              <p className="small muted">
                Ye clinic sirf paas waalon ko online token deta hai, isliye location maangenge.
              </p>
            )}
            {err?.form && <p className="notice notice-bad">{err.form}</p>}
          </form>
        )}
      </div>

      {clinic.isOpen && (
        <div className="dock">
          <div>
            <button form="join-form" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Token ban raha hai...' : 'Token lo'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
