// app/components/nav.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/characters', label: 'Characters' },
  { href: '/messages', label: 'Messages' },
  { href: '/generations', label: 'Generations' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/funnel', label: 'Funnel' },
  { href: '/generate/images', label: 'Images' },
  { href: '/generate/videos', label: 'Videos' },
  { href: '/runpod', label: 'RunPod' },
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