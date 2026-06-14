// app/funnel/total/page.tsx

'use client';

import { useEffect, useState, useCallback } from 'react';
import Nav from '../../components/nav';
import Link from 'next/link';

type Range = '1' | '7' | '14' | '30' | 'all';

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: '1', label: 'Yesterday' },
  { value: '7', label: '7D' },
  { value: '14', label: '14D' },
  { value: '30', label: '30D' },
  { value: 'all', label: 'All Time' },
];

interface FunnelStep {
  label: string;
  description: string;
  count: number;
}

export default function TotalFunnelPage() {
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState<Range>('all');

  const fetchFunnel = useCallback((r: Range) => {
    const password = sessionStorage.getItem('admin-pwd');
    if (!password) {
      window.location.href = '/';
      return;
    }

    setLoading(true);
    setError('');

    fetch(`/api/funnel/total?range=${r}`, {
      headers: { 'x-admin-password': password },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setSteps(data.steps);
        }
      })
      .catch(() => setError('Failed to load funnel data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchFunnel(range);
  }, [fetchFunnel, range]);

  const handleRangeChange = (r: Range) => {
    setRange(r);
    fetchFunnel(r);
  };

  const maxCount = steps.length > 0 ? Math.max(...steps.map((s) => s.count), 1) : 1;

  return (
    <>
      <Nav />
      <div className="funnel-page">
        <Link href="/funnel" className="funnel-back">← Funnels</Link>
        <div className="funnel-header">
          <h1 className="funnel-page-title">Total Users Funnel</h1>
          <div className="range-toggle">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleRangeChange(opt.value)}
                className={`range-button ${range === opt.value ? 'range-button-active' : ''}`}
                disabled={loading}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {loading && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '60px 0' }}>Loading...</p>}
        {error && <p style={{ color: 'var(--accent)', textAlign: 'center', padding: '60px 0' }}>{error}</p>}

        {!loading && !error && (
          <div className="funnel-container">
            {steps.map((step, i) => {
              const widthPct = (step.count / maxCount) * 100;
              const prevCount = i > 0 ? steps[i - 1].count : null;
              const dropoff = prevCount && prevCount > 0
                ? (((prevCount - step.count) / prevCount) * 100).toFixed(1)
                : null;
              const conversionFromTop = steps[0].count > 0
                ? ((step.count / steps[0].count) * 100).toFixed(1)
                : '0';

              return (
                <div key={step.label} className="funnel-step">
                  <div className="funnel-step-header">
                    <div className="funnel-step-label">
                      <span className="funnel-step-number">{i + 1}</span>
                      {step.description}
                    </div>
                    <div className="funnel-step-stats">
                      {dropoff && (
                        <span className="funnel-dropoff">▼ {dropoff}%</span>
                      )}
                      {i > 0 && (
                        <span className="funnel-conversion">{conversionFromTop}% of top</span>
                      )}
                    </div>
                  </div>
                  <div className="funnel-bar-track">
                    <div
                      className="funnel-bar-fill"
                      style={{ width: `${widthPct}%` }}
                    >
                      <span className="funnel-bar-count">
                        {step.count.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}