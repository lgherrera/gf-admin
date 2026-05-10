// app/generations/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import Nav from '../components/nav';

interface Generation {
  id: string;
  time: string;
  user: string;
  character: string;
  prompt: string;
}

export default function GenerationsPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchGenerations = useCallback(async (pwd: string, offset = 0, append = false) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/generations?offset=${offset}`, {
        headers: { 'x-admin-password': pwd },
      });
      if (!res.ok) {
        if (res.status === 401) {
          setAuthenticated(false);
          setError('Invalid password');
          return;
        }
        throw new Error('Failed to fetch');
      }
      const data = await res.json();
      setGenerations((prev) => (append ? [...prev, ...data.generations] : data.generations));
      setTotal(data.total);
      setAuthenticated(true);
    } catch {
      setError('Failed to load generations');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    fetchGenerations(password);
  };

  const loadMore = () => {
    fetchGenerations(password, generations.length, true);
  };

  // Check if password is in sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem('admin-pwd');
    if (saved) {
      setPassword(saved);
      fetchGenerations(saved);
    }
  }, [fetchGenerations]);

  // Save password on successful auth
  useEffect(() => {
    if (authenticated && password) {
      sessionStorage.setItem('admin-pwd', password);
    }
  }, [authenticated, password]);

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
            <button onClick={handleLogin} className="login-button" disabled={loading}>
              {loading ? 'Checking...' : 'Enter'}
            </button>
          </div>
          {error && <p className="login-error">{error}</p>}
        </div>
      </div>
    );
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }) +
      ' ' +
      d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <Nav />
      <div className="feed-page">
        <div className="feed-header">
          <h1 className="feed-title">Recent Generations</h1>
          <span className="feed-count">{total.toLocaleString()} total</span>
        </div>

        <table className="feed-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Character</th>
              <th>Prompt</th>
            </tr>
          </thead>
          <tbody>
            {generations.map((gen) => (
              <tr key={gen.id}>
                <td className="td-time">{formatTime(gen.time)}</td>
                <td className="td-user">{gen.user}</td>
                <td className="td-character">{gen.character}</td>
                <td className="td-prompt" title={gen.prompt}>
                  {gen.prompt}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {generations.length < total && (
          <button onClick={loadMore} className="load-more-button" disabled={loading}>
            {loading ? 'Loading...' : 'Load more'}
          </button>
        )}
      </div>
    </>
  );
}
