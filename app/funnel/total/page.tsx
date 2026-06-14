// app/funnel/total/page.tsx

'use client';

import { useEffect, useState } from 'react';
import Nav from '../../components/nav';
import Link from 'next/link';

interface FunnelStep {
  label: string;
  description: string;
  count: number;
}

export default function TotalFunnelPage() {
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const password = sessionStorage.getItem('admin_password');
    if (!password) {
      window.location.href = '/';
      return;
    }

    fetch('/api/funnel/total', {
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

  const maxCount = steps.length > 0 ? Math.max(...steps.map((s) => s.count), 1) : 1;

  return (
    <>
      <Nav />
      <main className="main-content">
        <div className="funnel-page-header">
          <Link href="/funnel" className="funnel-back">← Funnels</Link>
          <h1 className="page-title">Total Users Funnel</h1>
        </div>

        {loading && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '4rem 0' }}>Loading...</p>}
        {error && <p style={{ color: '#ef4444', textAlign: 'center', padding: '4rem 0' }}>{error}</p>}

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
      </main>
    </>
  );
}