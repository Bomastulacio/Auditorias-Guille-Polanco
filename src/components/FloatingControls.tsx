'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function FloatingControls() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showScroll, setShowScroll] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mainContent = document.getElementById('main-content');
    const handleScroll = () => {
      if (mainContent && mainContent.scrollTop > 300) {
        setShowScroll(true);
      } else {
        setShowScroll(false);
      }
    };
    mainContent?.addEventListener('scroll', handleScroll);
    return () => mainContent?.removeEventListener('scroll', handleScroll);
  }, []);

  if (!mounted) return null;

  const scrollToTop = () => {
    const mainContent = document.getElementById('main-content');
    mainContent?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-[100] flex flex-col gap-3">
      {/* Scroll to Top */}
      <AnimatePresence>
        {showScroll && (
          <motion.button
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            onClick={scrollToTop}
            className="w-11 h-11 bg-surface border border-nd-border-vis rounded-full flex items-center justify-center text-text-primary shadow-xl hover:bg-surface-raised transition-all active:scale-90"
            title="Deslizar arriba"
          >
            <ArrowUp size={18} strokeWidth={2} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Theme Toggle */}
      <motion.button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="w-11 h-11 bg-surface border border-nd-border-vis rounded-full flex items-center justify-center text-text-primary shadow-xl hover:bg-surface-raised transition-all active:scale-90 overflow-hidden"
        title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
      >
        <motion.div
          animate={{ rotate: theme === 'dark' ? 0 : 180 }}
          transition={{ type: "spring", stiffness: 200, damping: 10 }}
        >
          {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
        </motion.div>
      </motion.button>
    </div>
  );
}
