// app/components/nav.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/messages', label: 'Messages' },
  { href: '/generations', label: 'Generations' },
  { href: '/generate', label: 'Generate' },
  { href: '/runpod', label: 'RunPod' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/atlas-cloud', label: 'Atlas Cloud' },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      <span className="nav-brand">Polola IA</span>
      <div className="nav-links">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-link ${pathname === link.href ? 'nav-link-active' : ''}`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}