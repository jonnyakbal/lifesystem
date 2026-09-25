'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen, Search, Plus, Settings, LogOut, Menu, Sun, Moon, Orbit, ChevronDown, Layers } from 'lucide-react';
import { navigation, getPageContext } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { SettingsDialog, useTheme } from './settings';
import { NotificationCenter } from '@/components/notification-center';
import { useInboxCount } from '@/components/layout/nav-counts';
import { workspaceConfig } from '@/lib/workspace-config';

const mainDestinations = ['/', '/inbox', '/planejar', '/hoje', '/tarefas'];
const visibleNavigation = navigation.flatMap(group => group.items).filter(item => !workspaceConfig.hiddenModules.includes(item.href));

function openCommands() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
}

export function WorkspaceSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const page = getPageContext(pathname);
  const inboxCount = useInboxCount();
  const primaryItems = mainDestinations.flatMap(href => visibleNavigation.filter(item => item.href === href));
  const otherItems = visibleNavigation.filter(item => !mainDestinations.includes(item.href));
  const showOtherItems = moreOpen || otherItems.some(item => item.href === pathname);

  useEffect(() => {
    const open = () => setSettingsOpen(true);
    window.addEventListener('open-settings', open);
    return () => window.removeEventListener('open-settings', open);
  }, []);

  function renderNavigation(compact: boolean, mobile = false) {
    return <div className="workspace-sidebar-inner">
      <Link href="/" className="workspace-brand" onClick={() => setMobileOpen(false)} aria-label={`${workspaceConfig.name} — início`}>
        <BrandMark className="h-10 w-10 shrink-0" />
        {!compact && <span><strong>{workspaceConfig.name}</strong><small>{workspaceConfig.tagline}</small></span>}
      </Link>
      <button className={cn('workspace-search', compact && 'justify-center')} onClick={openCommands} aria-label="Buscar e abrir comandos">
        <Search size={17} />{!compact && <><span>Buscar no seu espaço</span><kbd>⌘ K</kbd></>}
      </button>
      <nav className="workspace-navigation" aria-label={mobile ? 'Todos os destinos' : 'Navegação principal'}>
        <div className="workspace-nav-group">
          {!compact && <p>Seu percurso</p>}
          {primaryItems.map(item => <Link key={item.href} href={item.href} title={compact ? item.title : undefined}
            aria-label={compact ? item.title : undefined} aria-current={pathname === item.href ? 'page' : undefined}
            onClick={() => setMobileOpen(false)} className={cn('workspace-nav-link', compact && 'is-compact')}>
            <item.icon size={18} strokeWidth={1.65} />{!compact && <span>{item.title}</span>}
            {item.href === '/inbox' && inboxCount > 0 && (
              <span className="workspace-nav-badge">{inboxCount > 99 ? '99+' : inboxCount}</span>
            )}
            {pathname === item.href && !compact && <span className="workspace-nav-dot" />}
          </Link>)}
        </div>
        {otherItems.length > 0 && <div className="workspace-nav-group">
          <button type="button" className={cn('workspace-nav-link w-full', compact && 'is-compact')} aria-label="Mais áreas" aria-expanded={showOtherItems} onClick={() => setMoreOpen(value => !value)}>
            <Layers size={18} strokeWidth={1.65} />{!compact && <><span>Mais áreas</span><ChevronDown size={15} className={cn('ml-auto transition-transform', showOtherItems && 'rotate-180')} /></>}
          </button>
          {showOtherItems && <div className="mt-1">{otherItems.map(item => <Link key={item.href} href={item.href} title={compact ? item.title : undefined}
            aria-label={compact ? item.title : undefined} aria-current={pathname === item.href ? 'page' : undefined}
            onClick={() => setMobileOpen(false)} className={cn('workspace-nav-link', compact && 'is-compact')}>
            <item.icon size={18} strokeWidth={1.65} />{!compact && <span>{item.title}</span>}
            {pathname === item.href && !compact && <span className="workspace-nav-dot" />}
          </Link>)}</div>}
        </div>}
      </nav>
      <div className="workspace-sidebar-footer">
        <Button onClick={openCommands} className="workspace-capture" aria-label="Captura rápida"><Plus size={18} />{!compact && 'Capturar uma ideia'}</Button>
        <div className={cn('workspace-utilities', compact && 'flex-col')}>
          <Button variant="ghost" size="icon" title="Configurações" aria-label="Abrir configurações" onClick={() => setSettingsOpen(true)}><Settings size={17} /></Button>
          <Button variant="ghost" size="icon" title="Alternar tema" aria-label="Alternar tema" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </Button>
          {!compact && <Button variant="ghost" size="icon" title="Sair" aria-label="Sair" onClick={async () => { const res = await fetch('/api/logout', { method: 'POST' }); if (res.ok) router.push('/login'); }}><LogOut size={17} /></Button>}
          {!mobile && <Button variant="ghost" size="icon" aria-label={compact ? 'Expandir navegação' : 'Recolher navegação'} onClick={onToggle}>
            {compact ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </Button>}
        </div>
      </div>
    </div>;
  }

  const mobileItems = primaryItems.slice(0, 3);
  return <>
    <aside className="workspace-sidebar hidden lg:flex">{renderNavigation(collapsed)}</aside>
    <header className="workspace-mobile-header lg:hidden">
      <Link href="/" aria-label="Ir para início"><BrandMark className="h-8 w-8" /></Link>
      <span className="flex-1 min-w-0 truncate font-semibold">{page?.title || 'LIFESYSTEM'}</span>
      <NotificationCenter />
      <Button variant="ghost" size="icon" aria-label="Buscar no seu espaço" onClick={openCommands}><Search size={19} /></Button>
    </header>
    <nav className="workspace-mobile-dock lg:hidden" aria-label="Navegação rápida">
      {mobileItems.map(item => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? 'page' : undefined} className="relative">
        <item.icon size={21} strokeWidth={1.7} /><span>{item.href === '/' ? 'Início' : item.title}</span>
        {item.href === '/inbox' && inboxCount > 0 && <span className="workspace-dock-badge" aria-label={`${inboxCount} capturas aguardando triagem`} />}
      </Link>)}
      <button onClick={openCommands} aria-label="Captura rápida"><Plus size={21} /><span>Capturar</span></button>
      <button onClick={() => setMobileOpen(true)} aria-label="Abrir todas as telas"><Menu size={21} /><span>Explorar</span></button>
    </nav>
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className="workspace-mobile-sheet w-[min(320px,90vw)] p-0">
        <SheetTitle className="sr-only">Explore seu espaço</SheetTitle><SheetDescription className="sr-only">Navegue pelas áreas do LIFESYSTEM.</SheetDescription>
        {renderNavigation(false, true)}
      </SheetContent>
    </Sheet>
    <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
  </>;
}

export function WorkspaceTopbar() {
  const page = getPageContext(usePathname());
  return <div className="workspace-topbar hidden lg:flex">
    <div className="flex items-center gap-2.5 text-xs"><Orbit size={16} className="text-primary" /><span className="text-muted-foreground">Meu espaço</span><span className="text-muted-foreground/40">/</span><span>{page?.title || 'LIFESYSTEM'}</span></div>
    <span className="ml-auto text-[11px] tracking-wide text-muted-foreground">Um passo de cada vez.</span>
    <NotificationCenter />
  </div>;
}
