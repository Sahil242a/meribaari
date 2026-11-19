import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext.js';
import { Brand, Field } from '../components/ui.jsx';

export default function StaffAuth({ mode }) {
  const { session, login, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', name: '', clinicName: '', department: '', address: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';

  if (session) return <Navigate to="/staff" replace />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (isLogin) await login(form.email, form.password);
      else await register(form);
      navigate('/staff');
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="stack" style={{ gap: 20, justifyItems: 'center', width: '100%' }}>
        <Brand light />
        <form className="auth-card" onSubmit={submit}>
          <div>
            <h2>{isLogin ? 'Staff login' : 'Apna clinic jodo'}</h2>
            <p className="muted small" style={{ marginTop: 4 }}>
              {isLogin
                ? 'Reception aur admin ke liye.'
                : 'Register karo, QR poster lagao, aaj se digital tokens shuru.'}
            </p>
          </div>

          {!isLogin && (
            <>
              <Field label="Clinic ka naam">
                <input
                  required
                  value={form.clinicName}
                  onChange={set('clinicName')}
                  placeholder="Sharma Eye Hospital"
                />
              </Field>
              <Field label="Department ya doctor" hint="(optional)">
                <input value={form.department} onChange={set('department')} placeholder="Eye OPD, Dr. Sharma" />
              </Field>
              <Field label="Address" hint="(optional)">
                <input value={form.address} onChange={set('address')} placeholder="Vaishali Nagar, Jaipur" />
              </Field>
              <Field label="Aapka naam">
                <input required value={form.name} onChange={set('name')} autoComplete="name" />
              </Field>
            </>
          )}
          <Field label="Email">
            <input required type="email" value={form.email} onChange={set('email')} autoComplete="email" />
          </Field>
          <Field label="Password" hint={isLogin ? '' : '(kam se kam 8 characters)'}>
            <input
              required
              type="password"
              minLength={isLogin ? 1 : 8}
              value={form.password}
              onChange={set('password')}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
          </Field>
          {err && <p className="notice notice-bad">{err}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Ruko...' : isLogin ? 'Login' : 'Clinic register karo'}
          </button>

          {isLogin ? (
            <div className="stack" style={{ gap: 6 }}>
              <p className="small">
                Naya clinic? <Link to="/staff/register">Register karo</Link>
              </p>
            </div>
          ) : (
            <p className="small">
              Account hai? <Link to="/staff/login">Login karo</Link>
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
