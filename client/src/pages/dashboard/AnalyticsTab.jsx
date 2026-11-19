import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { Bars } from '../../components/ui.jsx';

const hourLabel = (h) => `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}`;
const dayLabel = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' });

export default function AnalyticsTab() {
  const [a, setA] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    api('/staff/analytics')
      .then(setA)
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <p className="notice notice-bad">{err}</p>;
  if (!a) return <p className="muted">Loading...</p>;
  const t = a.today;

  // fill empty hours 8am-8pm so the chart reads like a clinic day
  const hours = Array.from({ length: 13 }, (_, i) => i + 8).map((h) => ({
    hour: hourLabel(h),
    count: a.byHour.find((x) => x.hour === h)?.count || 0,
  }));
  const peak = [...hours].sort((x, y) => y.count - x.count)[0];

  return (
    <div className="stack" style={{ gap: 24, paddingBottom: 48 }}>
      <div className="stats">
        <Stat label="Aaj ke tokens" value={t.issued} />
        <Stat label="Patients dekhe" value={t.served} />
        <Stat label="Average wait" value={t.avgWaitMin != null ? `${t.avgWaitMin} min` : '-'} />
        <Stat label="Avg consultation" value={t.avgServiceMin != null ? `${t.avgServiceMin} min` : '-'} />
        <Stat label="No-show rate" value={`${t.noShowRate}%`} />
        <Stat label="Walk-ins" value={t.walkIns} />
      </div>

      <div className="card">
        <div className="spread">
          <h3>Aaj kis time sabse zyada bheed</h3>
          {peak?.count > 0 && <span className="small muted">Peak: {peak.hour}</span>}
        </div>
        <Bars data={hours} valueKey="count" labelKey="hour" label="Tokens issued per hour today" />
      </div>

      <div className="card">
        <h3>Pichhle 7 din: patients dekhe</h3>
        <Bars
          data={a.last7Days.map((d) => ({ ...d, label: dayLabel(d.day) }))}
          valueKey="served"
          labelKey="label"
          alt
          label="Patients served per day, last 7 days"
        />
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span className="small muted">{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}
