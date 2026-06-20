// app/funnel/total/page.tsx

'use client';

import { useEffect, useState, useCallback } from 'react';
import Nav from '../../components/nav';
import Link from 'next/link';

type Range = '1' | '7' | '14' | '30' | 'all';
type Rating = 'all' | 'nsfw' | 'sfw';

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: '1', label: 'Yesterday' },
  { value: '7', label: '7D' },
  { value: '14', label: '14D' },
  { value: '30', label: '30D' },
  { value: 'all', label: 'All Time' },
];

const RATING_OPTIONS: { value: Rating; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'nsfw', label: 'NSFW' },
  { value: 'sfw', label: 'SFW' },
];

interface FunnelStep {
  label: string;
  description: string;
  count: number;
  indent: boolean;
}

export default function TotalFunnelPage() {
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState<Range>('all');
  const [rating, setRating] = useState<Rating>('all');
  const [serverTime, setServerTime] = useState('');

  const fetchFunnel = useCallback((r: Range, rt: Rating) => {
    const password = sessionStorage.getItem('admin-pwd');
    if (!password) {
      window.location.href = '/';
      return;
    }

    setLoading(true);
    setError('');

    fetch(`/api/funnel/total?range=${r}&rating=${rt}`, {
      headers: { 'x-admin-password': password },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setSteps(data.steps);
          setServerTime(data.serverTime);
        }
      })
      .catch(() => setError('Failed to load funnel data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchFunnel(range, rating);
  }, [fetchFunnel, range, rating]);

  const handleRangeChange = (r: Range) => {
    setRange(r);
  };

  const handleRatingChange = (rt: Rating) => {
    setRating(rt);
  };

  // Max count for bar scaling — compute separately for top-level and indented
  const topSteps = steps.filter((s) => !s.indent);
  const indentedSteps = steps.filter((s) => s.indent);
  const maxTopCount = topSteps.length > 0 ? Math.max(...topSteps.map((s) => s.count), 1) : 1;
  const maxIndentedCount = indentedSteps.length > 0 ? Math.max(...indentedSteps.map((s) => s.count), 1) : 1;

  // Homepage count for branch conversion rates
  const homepageCount = steps.find((s) => s.label === 'Home Page')?.count ?? 0;

  // Step numbering: top-level gets 1,2,3 — indented all get 4
  let topNumber = 0;

  return (
    <>
      <Nav />
      <div className="funnel-page">
        <Link href="/funnel" className="funnel-back">← Funnels</Link>
        <div className="funnel-header">
          <h1 className="funnel-page-title">Total Users Funnel</h1>
          <div className="funnel-header-controls">
            <div className="range-toggle">
              {RATING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleRatingChange(opt.value)}
                  className={`range-button ${
                    rating === opt.value
                      ? opt.value === 'nsfw'
                        ? 'funnel-rating-nsfw'
                        : opt.value === 'sfw'
                        ? 'funnel-rating-sfw'
                        : 'range-button-active'
                      : ''
                  }`}
                  disabled={loading}
                >
                  {opt.label}
                </button>
              ))}
            </div>
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
        </div>

        {serverTime && !loading && (
          <p className="funnel-period">
            Server time: {new Date(serverTime).toLocaleString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} UTC
          </p>
        )}

        {loading && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '60px 0' }}>Loading...</p>}
        {error && <p style={{ color: 'var(--accent)', textAlign: 'center', padding: '60px 0' }}>{error}</p>}

        {!loading && !error && (
          <div className="funnel-container">
            {steps.map((step, i) => {
              const isIndented = step.indent;

              // Determine step number
              let stepNumber: number;
              if (!isIndented) {
                topNumber++;
                stepNumber = topNumber;
              } else {
                stepNumber = topNumber + 1;
              }

              // Bar width relative to its group
              const maxCount = isIndented ? maxIndentedCount : maxTopCount;
              const widthPct = (step.count / maxCount) * 100;

              // Conversion stats
              let dropoff: string | null = null;
              let conversionFromTop: string | null = null;

              if (isIndented) {
                // Indented steps: dropoff and conversion relative to Homepage
                if (homepageCount > 0) {
                  dropoff = (((homepageCount - step.count) / homepageCount) * 100).toFixed(1);
                  conversionFromTop = ((step.count / steps[0].count) * 100).toFixed(1);
                }
              } else if (i > 0) {
                // Top-level steps: dropoff from previous top-level step
                const prevCount = steps[i - 1].count;
                if (prevCount > 0) {
                  dropoff = (((prevCount - step.count) / prevCount) * 100).toFixed(1);
                }
                if (steps[0].count > 0) {
                  conversionFromTop = ((step.count / steps[0].count) * 100).toFixed(1);
                }
              }

              return (
                <div key={step.label} className={`funnel-step ${isIndented ? 'funnel-step-indented' : ''}`}>
                  <div className="funnel-step-header">
                    <div className="funnel-step-label">
                      <span className="funnel-step-number">{stepNumber}</span>
                      {step.description}
                    </div>
                    <div className="funnel-step-stats">
                      {dropoff && (
                        <span className="funnel-dropoff">▼ {dropoff}%</span>
                      )}
                      {conversionFromTop && i > 0 && (
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