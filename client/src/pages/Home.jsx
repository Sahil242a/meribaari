import { Link } from 'react-router-dom';
import { Brand, SegBar, TAGLINE } from '../components/ui.jsx';

const YEAR = new Date().getFullYear();

export default function Home() {
  return (
    <div className="shell">
      <header className="nav">
        <Brand />
        <div className="row">
          <Link className="btn btn-ghost" to="/staff/login">
            Staff login
          </Link>
          <Link className="btn btn-primary" to="/staff/register">
            Clinic jodo
          </Link>
        </div>
      </header>

      <section className="hero">
        <div>
          <span className="pill pill-lime">Clinics, OPDs aur sarkari daftar ke liye</span>
          <h1 style={{ marginTop: 18 }}>{TAGLINE}</h1>
          <p className="lede">
            Ghanton waiting room mein baithne ki zarurat nahi. QR scan karke token lo, ghar ya kaam pe raho, aur jab
            aapki baari paas aaye, SMS aa jayega.
          </p>
          <div className="row">
            <Link className="btn btn-lime" to="/staff/register">
              Apna clinic jodo
            </Link>
            <Link
              className="btn"
              style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.4)' }}
              to="/staff/login"
            >
              Staff login
            </Link>
          </div>
        </div>

        <div className="hero-phone" aria-label="Example of the patient's token screen">
          <div className="app-head">
            <div className="spread meta">
              <span>City Care Clinic</span>
              <span className="pill pill-lime">Live</span>
            </div>
            <div className="head-token">
              <div>
                <div className="meta">Meri baari</div>
                <div className="num big">A-14</div>
              </div>
              <div className="side">
                <div className="meta">Wait</div>
                <div className="num">22 min</div>
              </div>
            </div>
          </div>
          <div className="body">
            <div className="relax" style={{ padding: 12 }}>
              <strong style={{ fontSize: '.95rem' }}>Abhi aane ki zarurat nahi.</strong>
              <span className="small muted">Baari se pehle SMS aa jayega.</span>
            </div>
            <div className="card" style={{ padding: 12, borderRadius: 14 }}>
              <span className="small muted">7 log aage</span>
              <SegBar total={8} position={6} />
            </div>
          </div>
        </div>
      </section>

      <section className="journey" aria-label="A patient's day with MeriBaari">
        <div>
          <span className="when">10:00 am, clinic pe</span>
          <h3>QR scan, token lo</h3>
          <p className="muted small">Naam aur mobile daalo. Koi app download nahi.</p>
          <span className="pill where">A-14 mil gaya</span>
        </div>
        <div>
          <span className="when">10:05 am, ghar ya kaam pe</span>
          <h3>Apna kaam karo</h3>
          <p className="muted small">Phone pe live dekho kitne log aage hain aur kitna time bacha hai.</p>
          <span className="pill where">7 log aage, 22 min</span>
        </div>
        <div>
          <span className="when">10:20 am, SMS aaya</span>
          <h3>Ab clinic aao</h3>
          <p className="muted small">3 number pehle SMS aur phone pe alert. Time pe pahunch jao.</p>
          <span className="pill where">2 log aage</span>
        </div>
        <div className="now">
          <span className="when">10:27 am, aapki baari</span>
          <h3>Seedha counter pe</h3>
          <p className="small">TV pe aapka number aur Hindi mein announcement. Bas andar jao.</p>
          <span className="pill where" style={{ background: '#fff' }}>
            Counter 1
          </span>
        </div>
      </section>

      <section className="demo-strip">
        <div>
          <h3>Apne clinic mein MeriBaari lagayein</h3>
          <p className="muted small">
            Register karo, QR poster print karke entrance pe lagao, aur reception pe ek click se agla patient bulao.
            Patients ko koi app download nahi karni.
          </p>
        </div>
        <div className="demo-links">
          <Link className="btn btn-primary" to="/staff/register">
            Clinic register karo
          </Link>
        </div>
      </section>

      <footer className="footer spread small muted">
        <span>
          &copy; {YEAR} MeriBaari. {TAGLINE}
        </span>
        <Link to="/staff/login" className="muted">
          Staff login
        </Link>
      </footer>
    </div>
  );
}
