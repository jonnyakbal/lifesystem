'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ReactLenis } from 'lenis/react';
import { MotionProvider } from '@/components/providers/motion-provider';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  return (
    <MotionProvider>
      <ReactLenis root options={{ lerp: 0.1, duration: 1.2, smoothWheel: !reducedMotion }}>
        {mounted ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeInOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        ) : (
          children
        )}
      </ReactLenis>
    </MotionProvider>
  );
}
