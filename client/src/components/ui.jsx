import { Link } from 'react-router-dom';

/** Logo: a token badge showing "1" (your turn is next) + two-weight wordmark. */
export function Brand({ to = '/', light = false }) {
  return (
    <Link to={to} className={`brand${light ? ' light' : ''}`} aria-label="MeriBaari home">
      <span className="brand-mark" aria-hidden="true">
        <span>1</span>
      </span>
      <span className="brand-text">
        <span className="brand-name">
          <span className="brand-meri">Meri</span>Baari
        </span>
        <span className="brand-deva" lang="hi">
          मेरी बारी
        </span>
      </span>
    </Link>
  );
}

/** The tagline, used on the home page, TV, poster and login. */
export const TAGLINE = 'Jab Baari Aaye, Tabhi Aayein!';

/**
 * Segmented progress: one segment per person who was ahead when you joined.
 * Green = already seen, lime = you.
 */
export function SegBar({ total, position }) {
  const n = Math.max(1, Math.min(total || 1, 30));
  const done = position == null ? n : Math.max(0, n - Math.min(position, n));
  return (
    <div className="segbar" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={i < done ? 'done' : i === n - 1 ? 'you' : ''} />
      ))}
    </div>
  );
}

export function LivePill({ connected = true }) {
  return (
    <span className="pill pill-lime">
      <span className="live-dot" aria-hidden="true" />
      {connected ? 'Live' : 'Reconnecting'}
    </span>
  );
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="field">
      <span>
        {label} {hint && <span className="hint">{hint}</span>}
      </span>
      {children}
      {error && <span className="error">{error}</span>}
    </label>
  );
}

export function Bars({ data, valueKey, labelKey, alt = false, label }) {
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  return (
    <div className="bars" role="img" aria-label={label}>
      {data.map((d) => (
        <div className="bar" key={d[labelKey]}>
          <span className="val">{d[valueKey] || ''}</span>
          <span className={`fill${alt ? ' alt' : ''}`} style={{ height: `${(d[valueKey] / max) * 100}%` }} />
          <span className="lbl">{d[labelKey]}</span>
        </div>
      ))}
    </div>
  );
}
