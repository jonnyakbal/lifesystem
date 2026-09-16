'use client';

import { usePathname } from 'next/navigation';
import { useState, type CSSProperties } from 'react';
import { WorkspaceSidebar, WorkspaceTopbar } from './workspace-sidebar';
import { AppShell } from './app-shell';
import { CommandPalette } from './command-palette';
import { CopilotoPanel } from './copiloto-panel';

// The login page renders full-bleed with no nav — it's the one route that
// must work before the user is authenticated, so it can't depend on
// anything (Sidebar, CommandPalette) that assumes a logged-in session.
export function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  if (pathname === '/login' || pathname === '/privacidade' || pathname === '/termos') {
    return <>{children}</>;
  }

  return (
    <div className="workspace-frame" style={{ '--workspace-sidebar-width': collapsed ? '80px' : '248px' } as CSSProperties}>
      <a href="#workspace-content" className="workspace-skip-link">Pular para o conteúdo</a>
      <WorkspaceSidebar collapsed={collapsed} onToggle={() => setCollapsed(value => !value)} />
      <main id="workspace-content" tabIndex={-1} className="astral-workspace workspace-main">
        <WorkspaceTopbar />
        <AppShell>{children}</AppShell>
      </main>
      <CommandPalette />
      <CopilotoPanel />
    </div>
  );
}
