// app/components/nav.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/messages', label: 'Messages' },
  { href: '/generations', label: 'Generations' },
  { href: '/generate/images', label: 'Images' },
  { href: '/generate/videos', label: 'Videos' },
  { href: '/runpod', label: 'RunPod' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/atlas-cloud', label: 'Atlas Cloud' },
  { href: '/funnel', label: 'Funnels' },
];

export default function Nav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <nav className="nav">
      <span className="nav-brand">Polola IA</span>
      <div className="nav-links">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-link ${isActive(link.href) ? 'nav-link-active' : ''}`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}