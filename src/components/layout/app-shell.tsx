'use client';

import { MotionProvider } from '@/components/providers/motion-provider';

export function AppShell({ children }: { children: React.ReactNode }) {
  return <MotionProvider><div className="workspace-page">{children}</div></MotionProvider>;
}
