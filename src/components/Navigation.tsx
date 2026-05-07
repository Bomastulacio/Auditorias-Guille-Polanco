'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Stethoscope, ListChecks, BarChart3, Plus } from 'lucide-react';
import clsx from 'clsx';

const NAV_ITEMS = [
  { href: '/', label: 'INICIO', icon: Home },
  { href: '/auditorias', label: 'AUDITORÍAS', icon: ListChecks },
  { href: '/medicos', label: 'MÉDICOS', icon: Stethoscope },
  { href: '/reportes', label: 'REPORTES', icon: BarChart3 },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-[196px] border-r border-nd-border bg-background h-screen sticky top-0 z-50 flex-shrink-0 transition-colors">
        {/* Brand */}
        <div className="h-14 flex items-center px-6 border-b border-nd-border">
          <span className="font-mono text-[11px] tracking-[0.12em] text-text-display">
            AUDITORÍA HC
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-3 flex flex-col">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'relative flex items-center gap-3 px-6 py-[11px] transition-all duration-200',
                  isActive
                    ? 'text-text-display before:absolute before:left-0 before:top-[20%] before:h-[60%] before:w-0.5 before:bg-text-display'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                <Icon size={17} strokeWidth={isActive ? 2 : 1.5} />
                <span className="font-mono text-[11px] tracking-[0.07em]">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* CTA */}
        <div className="p-4 border-t border-nd-border">
          <Link
            href="/auditorias/nueva"
            className="flex items-center justify-center gap-2 w-full h-10 bg-text-display text-background rounded-full font-mono text-[11px] tracking-[0.06em] hover:bg-text-primary transition-colors shadow-lg"
          >
            <Plus size={13} strokeWidth={2.5} />
            NUEVA
          </Link>
        </div>
      </aside>

      {/* ── Mobile bottom bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-nd-border pb-safe transition-colors shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.3)]">
        <div className="flex items-stretch h-14">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex flex-col items-center justify-center gap-[3px] flex-1 transition-colors',
                  isActive ? 'text-text-display' : 'text-text-secondary'
                )}
              >
                <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                <span className="font-mono text-[9px] tracking-[0.05em]">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Mobile FAB ── */}
      <Link
        href="/auditorias/nueva"
        className="md:hidden fixed bottom-[74px] right-4 z-50 flex items-center justify-center w-12 h-12 bg-text-display text-background rounded-full shadow-2xl active:scale-95 transition-transform"
      >
        <Plus size={20} strokeWidth={2.5} />
      </Link>
    </>
  );
}
