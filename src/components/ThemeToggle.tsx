'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-2.5 rounded-full border border-nd-border-vis bg-surface/30 backdrop-blur-sm text-text-secondary hover:text-text-primary transition-all active:scale-90"
      title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
    >
      <motion.div
        key={theme}
        initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
      </motion.div>
    </motion.button>
  );
}
