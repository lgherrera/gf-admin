// app/generate/videos/page.tsx

'use client';

import { useState, useEffect } from 'react';
import Nav from '../../components/nav';

export default function VideosPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('admin-pwd');
    if (saved) {
      setPassword(saved);
      setAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    sessionStorage.setItem('admin-pwd', password);
    setAuthenticated(true);
  };

  if (!authenticated) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h1 className="login-title">Polola IA</h1>
          <p className="login-subtitle">Admin Dashboard</p>
          <div className="login-form">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="login-input"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLogin(e);
              }}
              autoFocus
            />
            <button onClick={handleLogin} className="login-button">
              Enter
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Nav />
      <div className="gen-page" style={{ gridTemplateColumns: '1fr' }}>
        <div className="gen-empty" style={{ padding: '120px 0' }}>
          <div className="gen-empty-icon" style={{ fontSize: '48px' }}>🎬</div>
          <h1 className="gen-title">Video Generation</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Coming soon</p>
        </div>
      </div>
    </>
  );
}