// app/generations/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import Nav from '../components/nav';
import '../generations/generations.css';

interface Generation {
  id: string;
  time: string;
  user: string;
  character: string;
  status: string | null;
  prompt: string;
}

interface Stats {
  total: number;
  saved: number;
  censored: number;
  trashed: number;
}

type RatingFilter = 'all' | 'nsfw' | 'sfw';

export default function GenerationsPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rating, setRating] = useState<RatingFilter>('all');

  const fetchGenerations = useCallback(async (pwd: string, offset = 0, append = false, ratingFilter: RatingFilter = 'all') => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/generations?offset=${offset}&rating=${ratingFilter}`, {
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
      if (!append && data.stats) setStats(data.stats);
      setAuthenticated(true);
    } catch {
      setError('Failed to load generations');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    sessionStorage.setItem('admin-pwd', password);
    setAuthenticated(true);
    fetchGenerations(password, 0, false, rating);
  };

  const loadMore = () => {
    fetchGenerations(password, generations.length, true, rating);
  };

  const handleRatingChange = (newRating: RatingFilter) => {
    setRating(newRating);
    setGenerations([]);
    fetchGenerations(password, 0, false, newRating);
  };

  useEffect(() => {
    const saved = sessionStorage.getItem('admin-pwd');
    if (saved) {
      setPassword(saved);
      setAuthenticated(true);
      fetchGenerations(saved, 0, false, 'all');
    }
  }, [fetchGenerations]);

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
        {stats && (
          <div className="stat-cards">
            <div className="stat-card stat-card-total">
              <span className="stat-card-label">Total Images</span>
              <span className="stat-card-value">{stats.total.toLocaleString()}</span>
            </div>
            <div className="stat-card stat-card-saved">
              <span className="stat-card-label">Saved</span>
              <span className="stat-card-value">{stats.saved.toLocaleString()}</span>
            </div>
            <div className="stat-card stat-card-censored">
              <span className="stat-card-label">Censored</span>
              <span className="stat-card-value">{stats.censored.toLocaleString()}</span>
            </div>
            <div className="stat-card stat-card-trashed">
              <span className="stat-card-label">Trashed</span>
              <span className="stat-card-value">{stats.trashed.toLocaleString()}</span>
            </div>
          </div>
        )}

        <div className="feed-header">
          <div>
            <h1 className="feed-title">Recent Generations</h1>
            <span className="feed-count">{total.toLocaleString()} total</span>
          </div>
          <div className="rating-toggle-group">
            {(['all', 'nsfw', 'sfw'] as RatingFilter[]).map((r) => (
              <button
                key={r}
                onClick={() => handleRatingChange(r)}
                className={`rating-toggle-btn ${rating === r ? `rating-active-${r}` : ''}`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <table className="feed-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Character</th>
              <th>Status</th>
              <th>Prompt</th>
            </tr>
          </thead>
          <tbody>
            {generations.map((gen) => (
              <tr key={gen.id}>
                <td className="td-time">{formatTime(gen.time)}</td>
                <td className="td-user">{gen.user}</td>
                <td className="td-character">{gen.character}</td>
                <td className="td-status">
                  {gen.status ? (
                    <span className={`status-badge status-${gen.status}`}>{gen.status}</span>
                  ) : (
                    <span className="status-badge status-unknown">—</span>
                  )}
                </td>
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
