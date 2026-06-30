// app/tokens/page.tsx

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Nav from '../components/nav';
import './tokens.css';

interface TokenRow {
  model_used: string;
  content_rating: string;
  yesterday_tokens: number;
  last_7d_tokens: number;
  last_30d_tokens: number;
  all_time_tokens: number;
}

type Rating = 'all' | 'sfw' | 'nsfw';

const RANGE_KEYS = [
  { key: 'yesterday_tokens', label: 'Yesterday' },
  { key: 'last_7d_tokens', label: '7D' },
  { key: 'last_30d_tokens', label: '30D' },
  { key: 'all_time_tokens', label: 'All Time' },
] as const;

type RangeKey = (typeof RANGE_KEYS)[number]['key'];

const EMPTY: Record<RangeKey, number> = {
  yesterday_tokens: 0,
  last_7d_tokens: 0,
  last_30d_tokens: 0,
  all_time_tokens: 0,
};

export default function TokensPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [rows, setRows] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rating, setRating] = useState<Rating>('all');

  const fetchTokens = useCallback(async (pwd: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/tokens', {
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
      setRows(data.rows ?? []);
      setAuthenticated(true);
    } catch {
      setError('Failed to load token usage');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    fetchTokens(password);
  };

  // Restore session password
  useEffect(() => {
    const saved = sessionStorage.getItem('admin-pwd');
    if (saved) {
      setPassword(saved);
      fetchTokens(saved);
    }
  }, [fetchTokens]);

  // Persist password on successful auth
  useEffect(() => {
    if (authenticated && password) {
      sessionStorage.setItem('admin-pwd', password);
    }
  }, [authenticated, password]);

  // Filter by rating, then aggregate per model + grand totals across ranges.
  const { modelRows, totals } = useMemo(() => {
    const filtered =
      rating === 'all' ? rows : rows.filter((r) => r.content_rating === rating);

    const byModel = new Map<string, Record<RangeKey, number>>();
    const totalsAcc: Record<RangeKey, number> = { ...EMPTY };

    for (const r of filtered) {
      const cur = byModel.get(r.model_used) ?? { ...EMPTY };
      for (const { key } of RANGE_KEYS) {
        const v = Number(r[key] ?? 0);
        cur[key] += v;
        totalsAcc[key] += v;
      }
      byModel.set(r.model_used, cur);
    }

    const modelRows = Array.from(byModel.entries())
      .map(([model_used, vals]) => ({ model_used, ...vals }))
      .sort((a, b) => b.all_time_tokens - a.all_time_tokens);

    return { modelRows, totals: totalsAcc };
  }, [rows, rating]);

  const fmt = (n: number) => Number(n || 0).toLocaleString('en-US');

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
              {loading ? 'Loading...' : 'Enter'}
            </button>
            {error && <p className="login-error">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Nav />
      <main className="tk-main">
        <div className="tk-header">
          <h1 className="tk-title">Tokens</h1>
          <div className="tk-rating-group">
            <button
              className={`tk-rating ${rating === 'all' ? 'tk-rating-all-active' : ''}`}
              onClick={() => setRating('all')}
            >
              All
            </button>
            <button
              className={`tk-rating ${rating === 'sfw' ? 'tk-rating-sfw-active' : ''}`}
              onClick={() => setRating('sfw')}
            >
              SFW
            </button>
            <button
              className={`tk-rating ${rating === 'nsfw' ? 'tk-rating-nsfw-active' : ''}`}
              onClick={() => setRating('nsfw')}
            >
              NSFW
            </button>
          </div>
        </div>

        {/* Total tokens per range for the selected rating */}
        <div className="tk-cards">
          {RANGE_KEYS.map(({ key, label }) => (
            <div key={key} className="tk-card">
              <span className="tk-card-label">{label}</span>
              <span className="tk-card-value">{fmt(totals[key])}</span>
              <span className="tk-card-sub">total tokens</span>
            </div>
          ))}
        </div>

        {/* Breakdown by model_used */}
        <div className="tk-table-wrap">
          <table className="tk-table">
            <thead>
              <tr>
                <th className="tk-th-left">Model</th>
                {RANGE_KEYS.map(({ key, label }) => (
                  <th key={key}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && modelRows.length === 0 ? (
                <tr>
                  <td className="tk-empty" colSpan={5}>
                    Loading...
                  </td>
                </tr>
              ) : modelRows.length === 0 ? (
                <tr>
                  <td className="tk-empty" colSpan={5}>
                    No token usage found
                  </td>
                </tr>
              ) : (
                modelRows.map((row) => (
                  <tr key={row.model_used}>
                    <td className="tk-td-left">{row.model_used}</td>
                    {RANGE_KEYS.map(({ key }) => (
                      <td key={key}>{fmt(row[key])}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
            {modelRows.length > 0 && (
              <tfoot>
                <tr>
                  <td className="tk-td-left tk-total-label">Total</td>
                  {RANGE_KEYS.map(({ key }) => (
                    <td key={key} className="tk-total-value">
                      {fmt(totals[key])}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {error && <p className="tk-error">{error}</p>}
      </main>
    </>
  );
}