import React, { useState } from 'react';
import './App.css';

// All Monday.com access goes through this endpoint. The API token stays on the
// server — see api/checkin.js. Never call api.monday.com from the browser.
const CHECKIN_API = '/api/checkin';

const EMPTY_FORM = {
  name: '',
  certificateName: '',
  mobile: '',
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
  const registrationReady =
    formData.name.trim() &&
    formData.certificateName.trim() &&
    formData.mobile.trim() &&
    formData.nic.trim();

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
      finishWith('Checked In');
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
          ? 'You were already on the list — Checked In.'
          : 'Registered and Checked In'
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field) => (event) =>
    setFormData((current) => ({ ...current, [field]: event.target.value }));

  return (
    <div className="app-container">
      {screen === 'home' && (
        <div className="screen">
          <div className="header">
            <h1>ZeroPlastic Trail 2026</h1>
            <h2>Check-In System</h2>
          </div>

          <div className="input-section">
            <h3>Enter Your NIC Number</h3>
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
              {loading ? 'Checking In...' : 'Check In'}
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
              <span className="field-label">Name</span>
              <input
                type="text"
                value={formData.name}
                onChange={updateField('name')}
                autoComplete="name"
              />
            </label>

            <label className="field">
              <span className="field-label">Name for the Certificate</span>
              <input
                type="text"
                placeholder="Enter exactly as it should appear on the certificate"
                value={formData.certificateName}
                onChange={updateField('certificateName')}
              />
            </label>

            <label className="field">
              <span className="field-label">Mobile Number</span>
              <input
                type="tel"
                inputMode="numeric"
                value={formData.mobile}
                onChange={updateField('mobile')}
                autoComplete="tel"
              />
            </label>

            <label className="field">
              <span className="field-label">NIC</span>
              <input type="text" value={formData.nic} disabled />
            </label>
          </div>

          <button onClick={registerParticipant} disabled={loading || !registrationReady} className="btn btn-success">
            {loading ? 'Registering...' : 'Register & Check In'}
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
            <p>{participant?.successMessage || 'Checked In'}</p>
            <p className="subtitle">Redirecting...</p>
          </div>
        </div>
      )}
    </div>
  );
}
