import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

export default function ShareTab({ clinic }) {
  const joinUrl = `${window.location.origin}/c/${clinic.slug}`;
  const displayUrl = `${window.location.origin}/display/${clinic.slug}`;

  return (
    <div className="qgrid">
      <div className="card stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <QRCodeSVG value={joinUrl} size={220} level="M" marginSize={2} title="Join queue QR code" />
        <p className="small" style={{ wordBreak: 'break-all' }}>
          {joinUrl}
        </p>
        <Link className="btn btn-primary" to="/staff/poster" target="_blank">
          Poster print karo
        </Link>
      </div>
      <div className="stack">
        <div className="card stack" style={{ gap: 8 }}>
          <h3>Patients ke liye QR</h3>
          <p className="muted">
            Ye QR reception aur entrance pe lagao. Patient scan karke naam daalega aur token mil jayega. Koi app install
            nahi karni.
          </p>
        </div>
        <div className="card stack" style={{ gap: 8 }}>
          <h3>Waiting room TV</h3>
          <p className="muted">
            Kisi bhi smart TV ya purane laptop ke browser mein ye link kholo, full screen karo (F11). Naya number aate
            hi ghanti bajegi aur Hindi mein announcement hoga.
          </p>
          <p className="small" style={{ wordBreak: 'break-all' }}>
            {displayUrl}
          </p>
          <div>
            <Link className="btn" to={`/display/${clinic.slug}`} target="_blank">
              Display kholo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
