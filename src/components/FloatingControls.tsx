'use client';

import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function FloatingControls() {
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
    <div className="fixed bottom-20 right-4 md:bottom-8 md:right-8 z-[100]">
      <AnimatePresence>
        {showScroll && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={scrollToTop}
            className="w-10 h-10 bg-surface/40 backdrop-blur-md border border-nd-border-vis rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary transition-all active:scale-90"
            title="Subir"
          >
            <ArrowUp size={16} strokeWidth={2} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
