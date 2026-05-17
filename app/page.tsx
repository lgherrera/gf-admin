// app/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Nav from './components/nav';

interface Metrics {
  totalUsers: number;
  totalMessages: number;
  totalImages: number;
  activeToday: number;
  customGirlfriends: number;
  messagesPerDay: { date: string; count: number }[];
  imagesPerDay: { date: string; count: number }[];
  usersPerDay: { date: string; count: number }[];
  topGirlfriends: { name: string; count: number }[];
  topGenerators: { userId: string; name: string | null; msisdn: string | null; count: number }[];
  topUsers: { userId: string; name: string | null; msisdn: string | null; count: number }[];
}

export default function Dashboard() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchMetrics = useCallback(async (pwd: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/metrics', {
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
      setMetrics(data);
      setAuthenticated(true);
    } catch {
      setError('Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    fetchMetrics(password);
  };

  // Auto-refresh every hour
  useEffect(() => {
    if (!authenticated) return;
    const interval = setInterval(() => fetchMetrics(password), 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [authenticated, password, fetchMetrics]);

  // Check if password is in sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem('admin-pwd');
    if (saved) {
      setPassword(saved);
      fetchMetrics(saved);
    }
  }, [fetchMetrics]);

  // Save password on successful auth
  useEffect(() => {
    if (authenticated && password) {
      sessionStorage.setItem('admin-pwd', password);
    }
  }, [authenticated, password]);

  // ── Login gate ──
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

  // ── Loading state ──
  if (!metrics) {
    return (
      <div className="loading-container">
        <span className="loading-spinner" />
        Loading metrics...
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatDate = (label: any) => {
    const d = new Date(String(label) + 'T12:00:00');
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  };

  return (
    <>
      <Nav />
      <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Polola IA</h1>
          <p className="dashboard-subtitle">
            {new Date().toLocaleDateString('es-CL', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
            {' · '}
            {new Date().toLocaleTimeString('es-CL', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        <button
          onClick={() => fetchMetrics(password)}
          className="refresh-button"
          disabled={loading}
        >
          {loading ? '↻' : '↻ Refresh'}
        </button>
      </header>

      {/* Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Users</span>
          <span className="stat-value">{metrics.totalUsers.toLocaleString()}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Messages</span>
          <span className="stat-value">{metrics.totalMessages.toLocaleString()}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Images</span>
          <span className="stat-value">{metrics.totalImages.toLocaleString()}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Active Today</span>
          <span className="stat-value">{metrics.activeToday.toLocaleString()}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Custom Girlfriends</span>
          <span className="stat-value">{metrics.customGirlfriends.toLocaleString()}</span>
        </div>
      </div>

      {/* Messages Chart + Top Characters */}
      <div className="charts-grid">
        <div className="chart-card">
          <h2 className="chart-title">Messages — Last 14 Days</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.messagesPerDay}>
                <defs>
                  <linearGradient id="msgGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e60049" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#e60049" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  stroke="#555"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#555"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: '#e8e8e8',
                  }}
                  labelFormatter={formatDate}
                  formatter={(value: unknown) => [Number(value).toLocaleString(), 'Messages']}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#e60049"
                  strokeWidth={2}
                  fill="url(#msgGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#e60049', stroke: '#0a0a0a', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <h2 className="chart-title">Top Characters</h2>
          <div className="gf-list">
            {metrics.topGirlfriends.map((gf, i) => (
              <div key={gf.name} className="gf-row">
                <span className="gf-rank">{i + 1}</span>
                <span className="gf-name">{gf.name}</span>
                <span className="gf-count">{gf.count.toLocaleString()}</span>
              </div>
            ))}
            {metrics.topGirlfriends.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                No data yet
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Generated Images Chart + Top Generators */}
      <div className="charts-grid">
        <div className="chart-card">
          <h2 className="chart-title">Generated Images — Last 14 Days</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.imagesPerDay}>
                <defs>
                  <linearGradient id="imgGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f5a623" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f5a623" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  stroke="#555"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#555"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: '#e8e8e8',
                  }}
                  labelFormatter={formatDate}
                  formatter={(value: unknown) => [Number(value).toLocaleString(), 'Images']}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#f5a623"
                  strokeWidth={2}
                  fill="url(#imgGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#f5a623', stroke: '#0a0a0a', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <h2 className="chart-title">Top Generators</h2>
          <div className="gf-list">
            {metrics.topGenerators.map((user, i) => (
              <div key={user.userId} className="gf-row">
                <span className="gf-rank">{i + 1}</span>
                <span className="gf-name">
                  {user.msisdn || user.name || user.userId.slice(0, 8)}
                </span>
                <span className="gf-count">{user.count.toLocaleString()}</span>
              </div>
            ))}
            {metrics.topGenerators.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                No data yet
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Users Chart + Top Users */}
      <div className="charts-grid">
        <div className="chart-card">
          <h2 className="chart-title">New Users — Last 14 Days</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.usersPerDay}>
                <defs>
                  <linearGradient id="usersGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#348cd4" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#348cd4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  stroke="#555"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#555"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: '#e8e8e8',
                  }}
                  labelFormatter={formatDate}
                  formatter={(value: unknown) => [Number(value).toLocaleString(), 'Users']}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#348cd4"
                  strokeWidth={2}
                  fill="url(#usersGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#348cd4', stroke: '#0a0a0a', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <h2 className="chart-title">Top Users</h2>
          <div className="gf-list">
            {metrics.topUsers.map((user, i) => (
              <div key={user.userId} className="gf-row">
                <span className="gf-rank">{i + 1}</span>
                <span className="gf-name">
                  {user.msisdn || user.name || user.userId.slice(0, 8)}
                </span>
                <span className="gf-count">{user.count.toLocaleString()}</span>
              </div>
            ))}
            {metrics.topUsers.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                No data yet
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
