'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Logo } from './Header';
export function SplashScreen() {
  const [visible, setVisible] = useState(true); const reduced = useReducedMotion();
  useEffect(() => { const timer = setTimeout(() => setVisible(false), 2500); return () => clearTimeout(timer); }, []);
  return <AnimatePresence>{visible && <motion.div className="splash" aria-hidden="true" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : 0.25 }}><motion.div initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.7 }}><Logo/><div className="splash-line"/></motion.div></motion.div>}</AnimatePresence>;
}
