'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Inbox, Home, Target, Layers, FolderKanban, CheckSquare, BarChart3, Wallet, BookOpen,
  FileText, Command, Sparkles, Menu, ChevronLeft, ChevronRight, Bell, Settings,
  Sun, Moon, LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { SettingsDialog } from './settings';
import { NotificationCenter } from '@/components/notification-center';

const navigation = [
  { name: 'Home', href: '/', icon: Home, shortcut: '⌘H' },
  { name: 'INBOX', href: '/inbox', icon: Inbox, shortcut: '⌘I' },
  { name: 'Visão', href: '/visao', icon: Target, shortcut: '⌘V' },
  { name: 'Pilares', href: '/pilares', icon: Layers, shortcut: '⌘P' },
  { name: 'Projetos', href: '/projetos', icon: FolderKanban, shortcut: '⌘J' },
  { name: 'Tarefas', href: '/tarefas', icon: CheckSquare, shortcut: '⌘T' },
  { name: 'Conteúdo', href: '/conteudo', icon: FileText, shortcut: '⌘N' },
  { name: 'Indicadores', href: '/indicadores', icon: BarChart3, shortcut: '⌘D' },
  { name: 'Financeiro', href: '/financeiro', icon: Wallet, shortcut: '⌘F' },
  { name: 'Diário', href: '/diario', icon: BookOpen, shortcut: '⌘L' },
];

function SidebarContent({ collapsed, onToggleCollapse, onNavigate }: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch('/api/tasks').then(r => r.json()).then(tasks => {
      const todoCount = tasks.filter((t: { status: string }) => t.status === 'todo').length;
      setCounts(prev => ({ ...prev, tarefas: todoCount }));
    });
    fetch('/api/captures').then(r => r.json()).then(captures => {
      setCounts(prev => ({ ...prev, inbox: captures.length }));
    });
  }, [pathname]);

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className={cn(
        "relative flex h-16 items-center border-b border-border",
        collapsed ? "justify-center px-2" : "gap-3 px-6"
      )}>
        <motion.div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10"
          whileHover={{ scale: 1.08, rotate: -4 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
          <Command className="h-4 w-4 text-primary" />
        </motion.div>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
          >
            <span className="font-display text-lg font-bold tracking-tight">LIFESYSTEM</span>
          </motion.div>
        )}
        <div className="aurora-line" />

        {/* Collapse toggle - desktop only */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full border bg-background shadow-md hidden lg:flex"
          onClick={onToggleCollapse}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 space-y-1 p-4", collapsed && "px-2 py-4")}>
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const count = counts[item.name.toLowerCase()];
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'group relative flex items-center rounded-lg text-sm font-medium transition-colors',
                collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-lg bg-primary/10 ring-1 ring-primary/30"
                  style={{ boxShadow: '0 0 20px -4px hsl(262 95% 72% / 0.4)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
              <motion.span
                className="relative z-10 shrink-0"
                whileHover={{ x: collapsed ? 0 : 2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <div className="relative">
                  <item.icon className={cn(
                    "h-4 w-4 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  {count !== undefined && count > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                      {count > 9 ? '9+' : count}
                    </span>
                  )}
                </div>
              </motion.span>
              {!collapsed && (
                <>
                  <span className="relative z-10 flex-1">{item.name}</span>
                  <kbd className={cn(
                    "relative z-10 hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium transition-colors lg:inline-block",
                    isActive
                      ? "border-primary/20 bg-primary/5 text-primary"
                      : "text-muted-foreground"
                  )}>
                    {item.shortcut}
                  </kbd>
                </>
              )}
              {collapsed && (
                <div className="absolute left-full ml-2 rounded-md bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
                  {item.name}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* Quick Capture */}
      <div className={cn("p-4", collapsed && "px-2")}>
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
          {collapsed ? (
            <Button
               variant="outline"
               size="icon"
               className="w-full h-10 border-dashed border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 btn-captura-glow"
               onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
             >
               <Sparkles className="h-4 w-4" />
             </Button>
          ) : (
            <Button
               variant="outline"
               className="w-full justify-start gap-3 border-dashed border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary btn-captura-glow"
               onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
             >
               <Sparkles className="h-4 w-4" />
               <span>Captura Rápida</span>
               <kbd className="ml-auto rounded border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[10px]">
                 ⌘K
               </kbd>
             </Button>
          )}
        </motion.div>
      </div>

      {/* User */}
      <div className={cn("border-t border-border p-4", collapsed && "px-2")}>
        <motion.div
          className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}
          whileHover={{ x: collapsed ? 0 : 2 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20">
            <span className="font-display text-sm font-bold text-primary">J</span>
          </div>
          {!collapsed && (
            <>
              <div className="flex-1">
                <p className="text-sm font-medium">Jonny</p>
                <p className="text-xs text-muted-foreground">Em progresso</p>
              </div>
              <NotificationCenter />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-settings'));
                }}
              >
                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                title="Sair"
                onClick={async () => {
                  await fetch('/api/logout', { method: 'POST' });
                  window.location.href = '/login';
                }}
              >
                <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const stored = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (stored) {
      setTheme(stored);
      document.documentElement.classList.toggle('dark', stored === 'dark');
    }
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  }

  useEffect(() => {
    function handleOpenSettings() {
      setSettingsOpen(true);
    }
    window.addEventListener('open-settings', handleOpenSettings);
    return () => window.removeEventListener('open-settings', handleOpenSettings);
  }, []);

  return (
    <>
      {/* Mobile Header */}
      <div className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center gap-3 border-b border-border bg-background/80 backdrop-blur-xl px-4 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SidebarContent collapsed={false} onToggleCollapse={() => {}} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <Command className="h-4 w-4 text-primary" />
          <span className="font-display text-sm font-bold">LIFESYSTEM</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <div className="flex items-center gap-1">
          <NotificationCenter />
        </div>
      </div>

      {/* Desktop Sidebar */}
      <motion.aside
        className="fixed left-0 top-0 z-40 h-screen border-r border-border bg-card/50 backdrop-blur-xl hidden lg:block"
        animate={{ width: collapsed ? 64 : 256 }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      >
        <SidebarContent
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
        />
      </motion.aside>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
