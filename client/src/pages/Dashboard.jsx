import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/authContext.js';
import { Brand } from '../components/ui.jsx';
import QueueTab from './dashboard/QueueTab.jsx';
import AnalyticsTab from './dashboard/AnalyticsTab.jsx';
import SettingsTab from './dashboard/SettingsTab.jsx';
import ShareTab from './dashboard/ShareTab.jsx';

const TABS = [
  ['queue', 'Queue'],
  ['analytics', 'Analytics'],
  ['share', 'QR aur TV'],
  ['settings', 'Settings'],
];

export default function Dashboard() {
  const { session, logout } = useAuth();
  const [tab, setTab] = useState('queue');
  const { clinic, staff } = session;

  return (
    <>
      <header className="topnav">
        <div className="inner">
          <Brand to="/staff" light />
          <div className="tabs" role="tablist" aria-label="Dashboard sections">
            {TABS.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
          <div className="user">
            <Link className="btn btn-sm" to={`/display/${clinic.slug}`} target="_blank">
              TV kholo
            </Link>
            <span>{staff.name}</span>
            <button className="btn btn-sm" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="page">
        <div className="page-title">
          <p className="small muted">{clinic.name}</p>
        </div>
        {tab === 'queue' && <QueueTab />}
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'share' && <ShareTab clinic={clinic} />}
        {tab === 'settings' && <SettingsTab isAdmin={staff.role === 'admin'} />}
      </main>
    </>
  );
}
