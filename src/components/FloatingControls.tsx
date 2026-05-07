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
    <div className="fixed bottom-[88px] right-4 md:bottom-8 md:right-8 z-[100] flex flex-row-reverse gap-2 items-center">
      {/* Scroll to Top */}
      <AnimatePresence>
        {showScroll && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.5, x: 20 }}
            onClick={scrollToTop}
            className="w-10 h-10 bg-surface/80 backdrop-blur-md border border-nd-border-vis rounded-full flex items-center justify-center text-text-primary shadow-2xl hover:bg-surface transition-all active:scale-90"
            title="Subir"
          >
            <ArrowUp size={16} strokeWidth={2.5} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Theme Toggle - Minimalist style */}
      <motion.button
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="w-10 h-10 bg-surface/80 backdrop-blur-md border border-nd-border-vis rounded-full flex items-center justify-center text-text-primary shadow-2xl hover:bg-surface transition-all active:scale-90 overflow-hidden"
      >
        <motion.div
          key={theme}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
        </motion.div>
      </motion.button>
    </div>
  );
}
