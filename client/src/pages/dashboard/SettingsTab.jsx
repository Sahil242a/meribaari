import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/authContext.js';
import { Field } from '../../components/ui.jsx';

export default function SettingsTab({ isAdmin }) {
  const { refresh } = useAuth();
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState(null);
  const [members, setMembers] = useState([]);
  const [member, setMember] = useState({ name: '', email: '', password: '', role: 'receptionist' });

  useEffect(() => {
    api('/staff/clinic').then(setS);
    api('/staff/members').then(setMembers);
  }, []);

  if (!s) return <p className="muted">Loading...</p>;

  const set =
    (k, num = false) =>
    (e) =>
      setS({ ...s, [k]: num ? Number(e.target.value) : e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      await api('/staff/clinic', {
        method: 'PATCH',
        body: {
          name: s.name,
          department: s.department,
          address: s.address,
          tokenPrefix: s.tokenPrefix,
          defaultServiceMinutes: s.defaultServiceMinutes,
          alertWhenAhead: s.alertWhenAhead,
          maxWaiting: s.maxWaiting,
          counters: s.counters.map((c) => ({ id: c.id, name: c.name })),
          location: s.location,
          joinRadiusKm: s.joinRadiusKm,
        },
      });
      await refresh();
      setS(await api('/staff/clinic'));
      setMsg({ ok: true, text: 'Settings save ho gayi' });
    } catch (ex) {
      setMsg({ ok: false, text: ex.message });
    }
  };

  const useMyLocation = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) =>
        setS({
          ...s,
          location: { lat: p.coords.latitude, lng: p.coords.longitude },
          joinRadiusKm: s.joinRadiusKm || 2,
        }),
      () => setMsg({ ok: false, text: 'Location nahi mili. Browser mein allow karein.' })
    );

  const addMember = async (e) => {
    e.preventDefault();
    try {
      const m = await api('/staff/members', { method: 'POST', body: member });
      setMembers([...members, m]);
      setMember({ name: '', email: '', password: '', role: 'receptionist' });
    } catch (ex) {
      setMsg({ ok: false, text: ex.message });
    }
  };

  return (
    <div className="qgrid">
      <form className="card stack" onSubmit={save}>
        <h3>Clinic</h3>
        <fieldset disabled={!isAdmin} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <Field label="Naam">
            <input value={s.name} onChange={set('name')} />
          </Field>
          <Field label="Department ya doctor">
            <input value={s.department} onChange={set('department')} />
          </Field>
          <Field label="Address">
            <input value={s.address} onChange={set('address')} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Token prefix" hint="(A-12)">
              <input value={s.tokenPrefix} maxLength={2} onChange={set('tokenPrefix')} />
            </Field>
            <Field label="Default min/patient">
              <input
                type="number"
                min={1}
                max={120}
                value={s.defaultServiceMinutes}
                onChange={set('defaultServiceMinutes', true)}
              />
            </Field>
            <Field label="SMS jab #N pe ho">
              <input type="number" min={1} max={20} value={s.alertWhenAhead} onChange={set('alertWhenAhead', true)} />
            </Field>
            <Field label="Max waiting">
              <input type="number" min={1} value={s.maxWaiting} onChange={set('maxWaiting', true)} />
            </Field>
          </div>

          <div className="stack" style={{ gap: 8 }}>
            <strong className="small">Counters</strong>
            {s.counters.map((c, i) => (
              <div className="row" key={c.id || i} style={{ flexWrap: 'nowrap' }}>
                <input
                  value={c.name}
                  aria-label={`Counter ${i + 1} name`}
                  onChange={(e) =>
                    setS({ ...s, counters: s.counters.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })
                  }
                />
                {s.counters.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => setS({ ...s, counters: s.counters.filter((_, j) => j !== i) })}
                  >
                    Hatao
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="btn btn-sm"
              style={{ justifySelf: 'start' }}
              onClick={() => setS({ ...s, counters: [...s.counters, { name: `Counter ${s.counters.length + 1}` }] })}
            >
              Counter jodo
            </button>
          </div>

          <div className="stack" style={{ gap: 8 }}>
            <strong className="small">Sirf paas waale online token lein</strong>
            <p className="small muted">
              {s.location
                ? `Clinic location set hai. ${s.joinRadiusKm} km ke andar se hi token milega.`
                : 'Abhi koi bhi kahin se token le sakta hai.'}
            </p>
            <div className="row">
              <button type="button" className="btn btn-sm" onClick={useMyLocation}>
                Is jagah ko clinic location banao
              </button>
              {s.location && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setS({ ...s, location: null, joinRadiusKm: 0 })}
                >
                  Hatao
                </button>
              )}
            </div>
            {s.location && (
              <Field label="Radius (km)">
                <input
                  type="number"
                  min={0.2}
                  step={0.1}
                  max={100}
                  value={s.joinRadiusKm}
                  onChange={set('joinRadiusKm', true)}
                />
              </Field>
            )}
          </div>

          {msg && <p className={`notice ${msg.ok ? 'notice-ok' : 'notice-bad'}`}>{msg.text}</p>}
          {isAdmin ? (
            <button className="btn btn-primary">Settings save karo</button>
          ) : (
            <p className="small muted">Sirf admin settings badal sakta hai.</p>
          )}
        </fieldset>
      </form>

      <div className="card stack">
        <h3>Team</h3>
        <div className="stack" style={{ gap: 8 }}>
          {members.map((m) => (
            <div key={m.id} className="spread" style={{ borderBottom: '1px solid var(--mint)', paddingBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{m.name}</div>
                <div className="small muted">{m.email}</div>
              </div>
              <span className="pill">{m.role}</span>
            </div>
          ))}
        </div>
        {isAdmin && (
          <form className="stack" style={{ gap: 10 }} onSubmit={addMember}>
            <strong className="small">Receptionist jodo</strong>
            <input
              required
              placeholder="Naam"
              value={member.name}
              onChange={(e) => setMember({ ...member, name: e.target.value })}
              aria-label="Member name"
            />
            <input
              required
              type="email"
              placeholder="Email"
              value={member.email}
              onChange={(e) => setMember({ ...member, email: e.target.value })}
              aria-label="Member email"
            />
            <input
              required
              type="password"
              minLength={8}
              placeholder="Password (8+)"
              value={member.password}
              onChange={(e) => setMember({ ...member, password: e.target.value })}
              aria-label="Member password"
            />
            <select
              value={member.role}
              onChange={(e) => setMember({ ...member, role: e.target.value })}
              aria-label="Role"
            >
              <option value="receptionist">Receptionist</option>
              <option value="admin">Admin</option>
            </select>
            <button className="btn">Jodo</button>
          </form>
        )}
      </div>
    </div>
  );
}
