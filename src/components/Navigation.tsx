'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, ClipboardList, BarChart3, FileUp } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

const LINKS = [
  { href: '/', label: 'INICIO', icon: LayoutDashboard },
  { href: '/auditorias', label: 'AUDITORÍAS', icon: ClipboardList },
  { href: '/medicos', label: 'MÉDICOS', icon: Users },
  { href: '/reportes', label: 'REPORTES', icon: BarChart3 },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Top Bar (Theme Toggle only) */}
      <div className="fixed top-4 right-4 z-[110] md:hidden">
        <ThemeToggle />
      </div>

      {/* Desktop Sidebar */}
      <nav className="hidden md:flex flex-col w-64 bg-background border-r border-nd-border h-screen sticky top-0 p-8">
        <div className="mb-12">
          <p className="font-mono text-[10px] tracking-[0.2em] text-text-disabled mb-1 uppercase">Sistema de</p>
          <p className="text-xl font-bold tracking-tighter text-text-display">AUDITORÍA HC</p>
          <div className="h-[1px] w-8 bg-accent mt-4" />
        </div>

        <ul className="space-y-6 flex-1">
          {LINKS.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`flex items-center gap-4 font-mono text-[11px] tracking-[0.1em] transition-all group ${
                    isActive ? 'text-text-primary' : 'text-text-disabled hover:text-text-secondary'
                  }`}
                >
                  <div className={`p-2 rounded-lg transition-colors ${isActive ? 'bg-surface-raised border border-nd-border-vis' : 'group-hover:bg-surface'}`}>
                    <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                  </div>
                  {link.label}
                  {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Secondary utility link */}
        <div className="mt-auto pt-6 border-t border-nd-border space-y-4">
          <Link
            href="/importar"
            className={`flex items-center gap-4 font-mono text-[11px] tracking-[0.1em] transition-all group ${
              pathname.startsWith('/importar') ? 'text-text-primary' : 'text-text-disabled hover:text-text-secondary'
            }`}
          >
            <div className={`p-2 rounded-lg transition-colors ${pathname.startsWith('/importar') ? 'bg-surface-raised border border-nd-border-vis' : 'group-hover:bg-surface'}`}>
              <FileUp size={18} strokeWidth={pathname.startsWith('/importar') ? 2 : 1.5} />
            </div>
            IMPORTAR
            {pathname.startsWith('/importar') && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />}
          </Link>

          {/* Desktop Theme Toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-nd-border">
            <span className="font-mono text-[9px] text-text-disabled tracking-widest">TEMA</span>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-nd-border h-16 px-4 z-[110]">
        <ul className="flex items-center justify-around h-full">
          {LINKS.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            return (
              <li key={link.href} className="flex-1">
                <Link
                  href={link.href}
                  className={`flex flex-col items-center justify-center gap-1 transition-all ${
                    isActive ? 'text-text-primary' : 'text-text-disabled'
                  }`}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
                  <span className="font-mono text-[8px] tracking-tighter">{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
