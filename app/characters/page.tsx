// app/characters/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import Nav from '../components/nav';
import './characters.css';

type Range = '7' | '14' | '30' | 'all';
type TypeFilter = 'all' | 'standard' | 'custom';
type RatingFilter = 'all' | 'sfw' | 'nsfw';
type SortKey = 'visits' | 'messages';

interface Character {
  id: string;
  name: string;
  slug: string;
  avatar: string | null;
  type: string;
  rating: string | null;
  createdBy: string | null;
  visits: number;
  messages: number;
}

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: '7', label: '7D' },
  { value: '14', label: '14D' },
  { value: '30', label: '30D' },
  { value: 'all', label: 'All Time' },
];

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'standard', label: 'Standard' },
  { value: 'custom', label: 'Custom' },
];

const RATING_OPTIONS: { value: RatingFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'sfw', label: 'SFW' },
  { value: 'nsfw', label: 'NSFW' },
];

export default function CharactersPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [range, setRange] = useState<Range>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');
  const [sort, setSort] = useState<SortKey>('visits');

  const fetchCharacters = useCallback(
    async (pwd: string, r: Range, t: TypeFilter, rt: RatingFilter, s: SortKey) => {
      setLoading(true);
      setError('');
      try {
        const qs = new URLSearchParams({ range: r, sort: s });
        if (t !== 'all') qs.set('type', t);
        if (rt !== 'all') qs.set('rating', rt);

        const res = await fetch(`/api/characters?${qs.toString()}`, {
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
        setCharacters(data.characters || []);
        setAuthenticated(true);
      } catch {
        setError('Failed to load characters');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleLogin = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    fetchCharacters(password, range, typeFilter, ratingFilter, sort);
  };

  const applyChange = (next: {
    range?: Range;
    type?: TypeFilter;
    rating?: RatingFilter;
    sort?: SortKey;
  }) => {
    const r = next.range ?? range;
    const t = next.type ?? typeFilter;
    const rt = next.rating ?? ratingFilter;
    const s = next.sort ?? sort;
    setRange(r);
    setTypeFilter(t);
    setRatingFilter(rt);
    setSort(s);
    fetchCharacters(password, r, t, rt, s);
  };

  useEffect(() => {
    const saved = sessionStorage.getItem('admin-pwd');
    if (saved) {
      setPassword(saved);
      fetchCharacters(saved, 'all', 'all', 'all', 'visits');
    }
  }, [fetchCharacters]);

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

  const toggleSort = (key: SortKey) => {
    if (sort !== key) applyChange({ sort: key });
  };

  const ratio = (c: Character) => (c.visits > 0 ? (c.messages / c.visits).toFixed(1) : '—');

  return (
    <>
      <Nav />
      <div className="feed-page">
        <div className="feed-header">
          <h1 className="feed-title">Top Characters</h1>
          <span className="feed-count">{characters.length} shown</span>
        </div>

        {/* Filters */}
        <div className="char-filters">
          <div className="char-filter-group">
            <span className="char-filter-label">Type</span>
            <div className="range-toggle">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => applyChange({ type: opt.value })}
                  className={`range-button ${typeFilter === opt.value ? 'range-button-active' : ''}`}
                  disabled={loading}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="char-filter-group">
            <span className="char-filter-label">Rating</span>
            <div className="range-toggle">
              {RATING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => applyChange({ rating: opt.value })}
                  className={`range-button ${ratingFilter === opt.value ? 'range-button-active' : ''}`}
                  disabled={loading}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="char-filter-group">
            <span className="char-filter-label">Range</span>
            <div className="range-toggle">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => applyChange({ range: opt.value })}
                  className={`range-button ${range === opt.value ? 'range-button-active' : ''}`}
                  disabled={loading}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <table className="feed-table char-table">
          <thead>
            <tr>
              <th className="char-th-rank">#</th>
              <th>Character</th>
              <th>Type</th>
              <th>Rating</th>
              <th>Creator</th>
              <th
                className={`char-th-num char-sortable ${sort === 'visits' ? 'char-sort-active' : ''}`}
                onClick={() => toggleSort('visits')}
              >
                Visits {sort === 'visits' ? '▾' : ''}
              </th>
              <th
                className={`char-th-num char-sortable ${sort === 'messages' ? 'char-sort-active' : ''}`}
                onClick={() => toggleSort('messages')}
              >
                Messages {sort === 'messages' ? '▾' : ''}
              </th>
              <th className="char-th-num">Msgs / Visit</th>
            </tr>
          </thead>
          <tbody>
            {characters.map((c, i) => (
              <tr key={c.id}>
                <td className="char-td-rank">{i + 1}</td>
                <td>
                  <div className="char-cell">
                    {c.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.avatar} alt={c.name} className="char-avatar" />
                    ) : (
                      <div className="char-avatar char-avatar-fallback">
                        {c.name?.[0] ?? '?'}
                      </div>
                    )}
                    <span className="char-name">{c.name}</span>
                  </div>
                </td>
                <td>
                  <span
                    className={`char-badge ${
                      c.type === 'custom' ? 'char-badge-custom' : 'char-badge-standard'
                    }`}
                  >
                    {c.type === 'custom' ? 'Custom' : 'Standard'}
                  </span>
                </td>
                <td>
                  {c.rating ? (
                    <span
                      className={`char-badge ${
                        c.rating.toLowerCase() === 'nsfw' ? 'char-badge-nsfw' : 'char-badge-sfw'
                      }`}
                    >
                      {c.rating.toUpperCase()}
                    </span>
                  ) : (
                    <span className="char-td-creator">—</span>
                  )}
                </td>
                <td className="char-td-creator" title={c.createdBy ?? ''}>
                  {c.type === 'custom' ? c.createdBy ?? '—' : '—'}
                </td>
                <td className="char-td-num">{c.visits.toLocaleString()}</td>
                <td className="char-td-num">{c.messages.toLocaleString()}</td>
                <td className="char-td-num char-td-ratio">{ratio(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {loading && (
          <div className="char-loading">
            <span className="loading-spinner" /> Loading...
          </div>
        )}
        {!loading && characters.length === 0 && (
          <p className="char-empty">No characters with activity in this range.</p>
        )}
      </div>
    </>
  );
}