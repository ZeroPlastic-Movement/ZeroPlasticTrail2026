import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './App.css';

// All Monday.com access goes through this endpoint. The API token stays on the
// server — see api/checkin.js. Never call api.monday.com from the browser.
const CHECKIN_API = '/api/checkin';

const UNIVERSITIES = [
  'Open University of Sri Lanka',
  'University of Colombo',
  'University of Peradeniya',
  'University of Kelaniya',
  'University of Ruhuna',
  'University of Wayamba',
  'University of Vavuniya',
  'Sabaragamuwa University of Sri Lanka',
  'Ocean University of Sri Lanka',
  'CINEC',
  'NIBM',
  'NISD',
  'NDT',
  'SIBA Campus',
  'Other',
];

const EMPTY_FORM = {
  name: '',
  certificateName: '',
  mobile: '',
  university: '',
  medical: '',
  nic: '',
};

async function callCheckinApi(payload) {
  const response = await fetch(CHECKIN_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || 'Something went wrong. Please try again.');
  }
  return data;
}

export default function App() {
  const [screen, setScreen] = useState('home'); // home, found, notfound, success
  const [nic, setNic] = useState('');
  const [participant, setParticipant] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const qrRef = useRef(null);

  const resetToHome = () => {
    setScreen('home');
    setNic('');
    setParticipant(null);
    setFormData(EMPTY_FORM);
    setError('');
  };

  const finishWith = (message) => {
    setParticipant((current) => ({ ...current, successMessage: message }));
    setScreen('success');
    setTimeout(resetToHome, 4000);
  };

  const searchParticipant = async (nicNumber) => {
    setLoading(true);
    setError('');
    try {
      const result = await callCheckinApi({ action: 'search', nic: nicNumber });

      if (result.found) {
        setParticipant({
          itemId: result.itemId,
          name: result.name,
          nic: nicNumber,
          alreadyParticipated: result.alreadyParticipated,
        });
        setScreen('found');
      } else {
        setFormData({ ...EMPTY_FORM, nic: nicNumber });
        setScreen('notfound');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const markParticipated = async () => {
    setLoading(true);
    setError('');
    try {
      await callCheckinApi({ action: 'participate', itemId: participant.itemId });
      finishWith('Your participation has been recorded.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const registerParticipant = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await callCheckinApi({ action: 'register', ...formData });
      finishWith(
        result.duplicate
          ? 'You were already on the list — you are checked in.'
          : 'You are registered and checked in.'
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // qrcode.react v4 forwards this ref to the <svg> element itself, so serialise
  // it directly — there is no inner <svg> to query for.
  const downloadQR = () => {
    const svg = qrRef.current;
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width || 200;
      canvas.height = img.height || 200;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = 'cleanup-checkin-qr.png';
      link.click();
    };
    img.onerror = () => setError('Could not generate the QR image. Try a different browser.');
    img.src = 'data:image/svg+xml;base64,' + window.btoa(unescape(encodeURIComponent(svgData)));
  };

  const updateField = (field) => (event) =>
    setFormData((current) => ({ ...current, [field]: event.target.value }));

  return (
    <div className="app-container">
      {screen === 'home' && (
        <div className="screen">
          <div className="header">
            <h1>🌍 ZeroPlastic Cleanup</h1>
            <h2>Check-In System</h2>
          </div>

          <div className="qr-section">
            <h3>Scan QR Code or Enter NIC</h3>
            <div className="qr-code">
              <QRCodeSVG
                ref={qrRef}
                value={window.location.origin + window.location.pathname}
                size={200}
                level="H"
                marginSize={4}
              />
            </div>
            <button onClick={downloadQR} className="btn btn-secondary">
              📥 Download QR Code
            </button>
          </div>

          <div className="divider">OR</div>

          <div className="input-section">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Enter NIC Number"
              value={nic}
              onChange={(e) => setNic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && nic && searchParticipant(nic)}
            />
            <button
              onClick={() => nic && searchParticipant(nic)}
              disabled={loading || !nic}
              className="btn btn-primary"
            >
              {loading ? 'Searching...' : '🔍 Search'}
            </button>
          </div>

          {error && <div className="error">{error}</div>}
        </div>
      )}

      {screen === 'found' && (
        <div className="screen">
          <div className="success-box">
            <h2>✅ Welcome!</h2>
            <p className="name">{participant.name}</p>
            <p className="nic">NIC: {participant.nic}</p>
          </div>

          {participant.alreadyParticipated ? (
            <>
              <div className="info">You are already checked in — nothing more to do. Enjoy the cleanup!</div>
              <button onClick={resetToHome} className="btn btn-primary">
                Done
              </button>
            </>
          ) : (
            <button onClick={markParticipated} disabled={loading} className="btn btn-success">
              {loading ? 'Marking...' : '✓ Mark Me As Participated'}
            </button>
          )}

          <button onClick={resetToHome} className="btn btn-secondary">
            ← Back
          </button>

          {error && <div className="error">{error}</div>}
        </div>
      )}

      {screen === 'notfound' && (
        <div className="screen">
          <h2>NIC Not Found</h2>
          <p className="subtitle">Please register to participate</p>

          <div className="form">
            <label className="field">
              <span className="field-label">Full Name</span>
              <input type="text" value={formData.name} onChange={updateField('name')} />
            </label>

            <label className="field">
              <span className="field-label">Name with Initials <em>(as it should appear on your certificate)</em></span>
              <input
                type="text"
                placeholder="e.g. A. B. C. Perera"
                value={formData.certificateName}
                onChange={updateField('certificateName')}
              />
            </label>

            <label className="field">
              <span className="field-label">Mobile Number (WhatsApp)</span>
              <input
                type="tel"
                inputMode="numeric"
                value={formData.mobile}
                onChange={updateField('mobile')}
              />
            </label>

            <label className="field">
              <span className="field-label">University / Institution</span>
              <select value={formData.university} onChange={updateField('university')}>
                <option value="">Select University</option>
                {UNIVERSITIES.map((university) => (
                  <option key={university} value={university}>
                    {university}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">
                Any medical conditions or medication we should know about?
              </span>
              <input
                type="text"
                placeholder="Type 'No' if none"
                value={formData.medical}
                onChange={updateField('medical')}
              />
            </label>

            <label className="field">
              <span className="field-label">NIC Number</span>
              <input type="text" value={formData.nic} disabled />
            </label>
          </div>

          <button onClick={registerParticipant} disabled={loading} className="btn btn-success">
            {loading ? 'Registering...' : '✓ Check In'}
          </button>

          <button onClick={resetToHome} className="btn btn-secondary">
            ← Back
          </button>

          {error && <div className="error">{error}</div>}
        </div>
      )}

      {screen === 'success' && (
        <div className="screen success-screen">
          <div className="success-box large">
            <h1>✅</h1>
            <h2>Thank You!</h2>
            <p>{participant?.successMessage || 'Your participation has been recorded.'}</p>
            <p className="subtitle">Redirecting...</p>
          </div>
        </div>
      )}
    </div>
  );
}
