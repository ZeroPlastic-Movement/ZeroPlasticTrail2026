import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';
import './App.css';

const MONDAY_API_URL = 'https://api.monday.com/v2';
const API_TOKEN = import.meta.env.VITE_MONDAY_API_TOKEN;
const BOARD_ID = '5031418117';

export default function App() {
  const [screen, setScreen] = useState('home'); // home, search, found, notfound, register, success
  const [nic, setNic] = useState('');
  const [participant, setParticipant] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ name: '', mobile: '', university: '', nic: '' });
  const qrRef = useRef();

  // Search for participant by NIC
  const searchParticipant = async (nicNumber) => {
    setLoading(true);
    setError('');
    try {
      const query = `
        query {
          boards(ids: ${BOARD_ID}) {
            items {
              id
              name
              column_values {
                id
                text
              }
            }
          }
        }
      `;

      const response = await axios.post(MONDAY_API_URL, { query }, {
        headers: { Authorization: API_TOKEN }
      });

      const items = response.data.data.boards[0]?.items || [];
      const found = items.find(item => {
        const nicCol = item.column_values.find(col => col.id === 'numeric_mm7brhp6');
        return nicCol?.text === nicNumber;
      });

      if (found) {
        setParticipant({
          itemId: found.id,
          name: found.name,
          nic: nicNumber
        });
        setScreen('found');
      } else {
        setFormData({ ...formData, nic: nicNumber });
        setScreen('notfound');
      }
    } catch (err) {
      setError('Error searching participant. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Mark as participated
  const markParticipated = async () => {
    setLoading(true);
    setError('');
    try {
      const mutation = `
        mutation {
          change_column_value(board_id: ${BOARD_ID}, item_id: "${participant.itemId}", column_id: "color_mm7b7q8k", value: "{\\"label\\":\\"Yes\\"}") {
            id
          }
        }
      `;

      await axios.post(MONDAY_API_URL, { query: mutation }, {
        headers: { Authorization: API_TOKEN }
      });

      setScreen('success');
      setTimeout(() => {
        setScreen('home');
        setNic('');
        setParticipant(null);
      }, 3000);
    } catch (err) {
      setError('Error marking participation. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Register new participant
  const registerParticipant = async () => {
    if (!formData.name || !formData.mobile || !formData.university || !formData.nic) {
      setError('All fields are required');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const mutation = `
        mutation {
          create_item(board_id: ${BOARD_ID}, item_name: "${formData.name}", column_values: "{\\"numeric_mm7bz03e\\":\\"${formData.mobile}\\", \\"numeric_mm7brhp6\\":\\"${formData.nic}\\", \\"color_mm7bmtcx\\":{\\"label\\":\\"${formData.university}\\"}, \\"color_mm7b7q8k\\":{\\"label\\":\\"Yes\\"}}") {
            id
          }
        }
      `;

      await axios.post(MONDAY_API_URL, { query: mutation }, {
        headers: { Authorization: API_TOKEN }
      });

      setScreen('success');
      setTimeout(() => {
        setScreen('home');
        setNic('');
        setFormData({ name: '', mobile: '', university: '', nic: '' });
      }, 3000);
    } catch (err) {
      setError('Error registering. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = () => {
    const svg = qrRef.current.querySelector('svg');
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = 'cleanup-checkin-qr.png';
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <div className="app-container">
      {/* Home Screen */}
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
                value={window.location.href}
                size={200}
                level="H"
                includeMargin={true}
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
              placeholder="Enter NIC Number"
              value={nic}
              onChange={(e) => setNic(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && nic && searchParticipant(nic)}
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

      {/* Found - Mark Participated */}
      {screen === 'found' && (
        <div className="screen">
          <div className="success-box">
            <h2>✅ Welcome!</h2>
            <p className="name">{participant.name}</p>
            <p className="nic">NIC: {participant.nic}</p>
          </div>

          <button
            onClick={markParticipated}
            disabled={loading}
            className="btn btn-success"
          >
            {loading ? 'Marking...' : '✓ Mark Me As Participated'}
          </button>

          <button onClick={() => { setScreen('home'); setNic(''); setParticipant(null); }} className="btn btn-secondary">
            ← Back
          </button>

          {error && <div className="error">{error}</div>}
        </div>
      )}

      {/* Not Found - Register */}
      {screen === 'notfound' && (
        <div className="screen">
          <h2>NIC Not Found</h2>
          <p className="subtitle">Please register to participate</p>

          <div className="form">
            <input
              type="text"
              placeholder="Full Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />

            <input
              type="text"
              placeholder="Mobile Number"
              value={formData.mobile}
              onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
            />

            <select
              value={formData.university}
              onChange={(e) => setFormData({ ...formData, university: e.target.value })}
            >
              <option value="">Select University</option>
              <option value="Open University of Sri Lanka">Open University of Sri Lanka</option>
              <option value="University of Colombo">University of Colombo</option>
              <option value="University of Peradeniya">University of Peradeniya</option>
              <option value="University of Kelaniya">University of Kelaniya</option>
              <option value="University of Ruhuna">University of Ruhuna</option>
              <option value="CINEC">CINEC</option>
              <option value="NIBM">NIBM</option>
              <option value="Other">Other</option>
            </select>

            <input
              type="text"
              placeholder="NIC Number"
              value={formData.nic}
              onChange={(e) => setFormData({ ...formData, nic: e.target.value })}
              disabled
            />
          </div>

          <button
            onClick={registerParticipant}
            disabled={loading}
            className="btn btn-success"
          >
            {loading ? 'Registering...' : '✓ Check In'}
          </button>

          <button onClick={() => { setScreen('home'); setNic(''); }} className="btn btn-secondary">
            ← Back
          </button>

          {error && <div className="error">{error}</div>}
        </div>
      )}

      {/* Success */}
      {screen === 'success' && (
        <div className="screen success-screen">
          <div className="success-box large">
            <h1>✅</h1>
            <h2>Thank You!</h2>
            <p>Your participation has been recorded.</p>
            <p className="subtitle">Redirecting...</p>
          </div>
        </div>
      )}
    </div>
  );
}
