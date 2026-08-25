'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { AppShell } from './app-shell';
import { CommandPalette } from './command-palette';

// The login page renders full-bleed with no nav — it's the one route that
// must work before the user is authenticated, so it can't depend on
// anything (Sidebar, CommandPalette) that assumes a logged-in session.
export function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <main className="pt-14 pb-16 lg:pl-64 lg:pt-0 lg:pb-0">
        <AppShell>{children}</AppShell>
      </main>
      <CommandPalette />
    </>
  );
}
