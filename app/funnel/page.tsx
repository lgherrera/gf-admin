// app/funnel/page.tsx

'use client';

import Nav from '../components/nav';
import Link from 'next/link';

const funnels = [
  { href: '/funnel/total', label: 'Total Users', description: 'Total row counts at each stage' },
];

export default function FunnelIndex() {
  return (
    <>
      <Nav />
      <div className="funnel-page">
        <h1 className="funnel-page-title">Funnels</h1>
        <div className="funnel-index-grid">
          {funnels.map((f) => (
            <Link key={f.href} href={f.href} className="funnel-index-card">
              <span className="funnel-index-card-label">{f.label}</span>
              <span className="funnel-index-card-desc">{f.description}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}