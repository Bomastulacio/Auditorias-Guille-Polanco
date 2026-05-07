'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Stethoscope, ListChecks, BarChart3, Plus, Menu, X } from 'lucide-react';
import clsx from 'clsx';

const NAV_ITEMS = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/auditorias', label: 'Auditorías', icon: ListChecks },
  { href: '/medicos', label: 'Médicos', icon: Stethoscope },
  { href: '/reportes', label: 'Reportes', icon: BarChart3 },
];

export default function Navigation() {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <>
      {/* --- DESKTOP SIDEBAR --- */}
      <aside className={clsx(
        "hidden md:flex flex-col w-64 border-r border-border/20 surface-elevated h-screen sticky top-0 z-50 transition-all duration-300",
        !isSidebarOpen && "md:w-20"
      )}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-border/20">
          {isSidebarOpen && (
            <span className="font-display text-lg font-bold text-foreground">
              Auditoria <span className="text-primary">HC</span>
            </span>
          )}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-full hover:bg-white/5 text-text-secondary transition-colors"
          >
            <Menu size={20} />
          </button>
        </div>
        
        <nav className="flex-1 py-4 flex flex-col gap-2 px-3">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200",
                  isActive 
                    ? "bg-primary/20 text-primary font-medium" 
                    : "text-text-secondary hover:bg-white/5 hover:text-foreground"
                )}
                title={item.label}
              >
                <Icon size={22} className={clsx(isActive && "text-primary")} />
                {isSidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Desktop FAB equivalent */}
        {isSidebarOpen ? (
          <div className="p-4">
            <Link 
              href="/auditorias/nueva" 
              className="flex items-center justify-center gap-2 w-full bg-primary hover:bg-primary/80 text-primary-foreground py-3 rounded-[16px] shadow-glow transition-all"
            >
              <Plus size={20} />
              <span>Nueva Auditoría</span>
            </Link>
          </div>
        ) : (
          <div className="p-3">
            <Link 
              href="/auditorias/nueva" 
              className="flex items-center justify-center w-full aspect-square bg-primary hover:bg-primary/80 text-primary-foreground rounded-[16px] shadow-glow transition-all"
              title="Nueva Auditoría"
            >
              <Plus size={24} />
            </Link>
          </div>
        )}
      </aside>

      {/* --- MOBILE BOTTOM BAR --- */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 surface-elevated border-t border-border/20 pb-safe">
        <div className="flex items-center justify-around h-16">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                  isActive ? "text-primary" : "text-text-secondary"
                )}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* --- MOBILE FAB (Floating Action Button) --- */}
      <Link 
        href="/auditorias/nueva"
        className="md:hidden fixed bottom-20 right-4 z-50 flex items-center justify-center w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-glow active:scale-95 transition-transform"
      >
        <Plus size={28} />
      </Link>
    </>
  );
}
