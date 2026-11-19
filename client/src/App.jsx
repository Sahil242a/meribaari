import { Link, Route, Routes } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Join from './pages/Join.jsx';
import TokenPage from './pages/TokenPage.jsx';
import StaffAuth from './pages/StaffAuth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Display from './pages/Display.jsx';
import Poster from './pages/Poster.jsx';
import { RequireStaff } from './lib/auth.jsx';
import { Brand } from './components/ui.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/c/:slug" element={<Join />} />
      <Route path="/t/:id" element={<TokenPage />} />
      <Route path="/display/:slug" element={<Display />} />
      <Route path="/staff/login" element={<StaffAuth mode="login" />} />
      <Route path="/staff/register" element={<StaffAuth mode="register" />} />
      <Route
        path="/staff"
        element={
          <RequireStaff>
            <Dashboard />
          </RequireStaff>
        }
      />
      <Route
        path="/staff/poster"
        element={
          <RequireStaff>
            <Poster />
          </RequireStaff>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function NotFound() {
  return (
    <div className="phone pad stack" style={{ paddingTop: 20 }}>
      <Brand />
      <h2>Ye page nahi mila</h2>
      <p className="muted">Link check karein, ya clinic ka QR code dobara scan karein.</p>
      <Link className="btn" to="/">
        Home pe jaao
      </Link>
    </div>
  );
}
