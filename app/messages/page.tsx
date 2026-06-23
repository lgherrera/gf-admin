// app/messages/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import Nav from '../components/nav';
import './messages.css';

interface Message {
  id: string;
  time: string;
  user: string;
  character: string;
  role: string;
  content: string;
  content_rating: string;
}

type RatingFilter = 'all' | 'nsfw' | 'sfw';

export default function MessagesPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rating, setRating] = useState<RatingFilter>('all');

  const fetchMessages = useCallback(async (pwd: string, offset = 0, append = false, ratingFilter: RatingFilter = 'all') => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/messages?offset=${offset}&rating=${ratingFilter}`, {
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
      setMessages((prev) => (append ? [...prev, ...data.messages] : data.messages));
      setTotal(data.total);
      setAuthenticated(true);
    } catch {
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    fetchMessages(password, 0, false, rating);
  };

  const loadMore = () => {
    fetchMessages(password, messages.length, true, rating);
  };

  const handleRatingChange = (newRating: RatingFilter) => {
    setRating(newRating);
    setMessages([]);
    fetchMessages(password, 0, false, newRating);
  };

  useEffect(() => {
    const saved = sessionStorage.getItem('admin-pwd');
    if (saved) {
      setPassword(saved);
      fetchMessages(saved, 0, false, 'all');
    }
  }, [fetchMessages]);

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
          <div>
            <h1 className="feed-title">Recent Messages</h1>
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
              <th>Role</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((msg) => (
              <tr key={msg.id}>
                <td className="td-time">{formatTime(msg.time)}</td>
                <td className="td-user">{msg.user}</td>
                <td className="td-character">{msg.character}</td>
                <td className={`td-role ${msg.role === 'user' ? 'td-role-user' : 'td-role-ai'}`}>
                  {msg.role === 'user' ? 'User' : 'AI'}
                </td>
                <td className="td-message" title={msg.content}>
                  {msg.content}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {messages.length < total && (
          <button onClick={loadMore} className="load-more-button" disabled={loading}>
            {loading ? 'Loading...' : 'Load more'}
          </button>
        )}
      </div>
    </>
  );
}