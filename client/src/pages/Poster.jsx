import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../lib/authContext.js';
import { Brand } from '../components/ui.jsx';

/** A4 poster for the reception desk. Print from the browser. */
export default function Poster() {
  const { session } = useAuth();
  const { clinic } = session;
  const joinUrl = `${window.location.origin}/c/${clinic.slug}`;

  return (
    <>
      <div className="no-print row" style={{ padding: 16, justifyContent: 'center' }}>
        <button className="btn btn-primary" onClick={() => window.print()}>
          Print karo
        </button>
      </div>
      <div className="poster">
        <div className="poster-top">
          <Brand light />
          <h1>Jab Baari Aaye, Tabhi Aayein!</h1>
          <p style={{ fontSize: '1.25rem', color: '#d7ece2' }}>Scan karo, token lo, aur baari se pehle SMS paao.</p>
        </div>
        <div className="poster-body">
          <div
            style={{ padding: 16, background: '#fff', border: '4px solid #0B6E4F', borderRadius: 24, lineHeight: 0 }}
          >
            <QRCodeSVG value={joinUrl} size={300} level="M" marginSize={0} fgColor="#0B3D2C" />
          </div>
          <h2>{clinic.name}</h2>
          <ol style={{ textAlign: 'left', fontSize: '1.15rem', lineHeight: 1.9, margin: 0 }}>
            <li>Phone ka camera kholo aur QR scan karo</li>
            <li>Naam aur mobile number daalo</li>
            <li>Phone pe live dekho kitne log aage hain</li>
            <li>Baari se pehle SMS aa jayega</li>
          </ol>
          <p className="muted">Smartphone nahi hai? Reception pe token le lijiye.</p>
          <p className="small muted" style={{ wordBreak: 'break-all' }}>
            {joinUrl}
          </p>
        </div>
      </div>
    </>
  );
}
