'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell, AlertTriangle, Clock, DollarSign, BookOpen, Inbox, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Task, Budget, JournalEntry, Capture } from '@/types';

interface Notification {
  id: string;
  icon: React.ReactNode;
  message: string;
  href: string;
  type: 'overdue' | 'due-today' | 'budget' | 'journal' | 'capture';
}

const STORAGE_KEY = 'lifesystem-read-notifications';

function getReadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markRead(id: string) {
  const ids = getReadIds();
  ids.add(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

function markAllRead(ids: string[]) {
  const read = getReadIds();
  ids.forEach(id => read.add(id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...read]));
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function daysDiff(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function buildNotifications(
  tasks: Task[],
  budgets: Budget[],
  journal: JournalEntry[],
  captures: Capture[]
): Notification[] {
  const today = todayStr();
  const notifications: Notification[] = [];

  for (const t of tasks) {
    if (t.status === 'done' || !t.dueDate) continue;
    if (t.dueDate < today) {
      notifications.push({
        id: `overdue-${t.id}`,
        icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
        message: `Tarefa atrasada: ${t.title}`,
        href: '/tarefas',
        type: 'overdue',
      });
    } else if (t.dueDate === today) {
      notifications.push({
        id: `today-${t.id}`,
        icon: <Clock className="h-4 w-4 text-amber-500" />,
        message: `Vence hoje: ${t.title}`,
        href: '/tarefas',
        type: 'due-today',
      });
    }
  }

  const currentMonth = today.slice(0, 7);
  for (const b of budgets) {
    if (b.month === currentMonth && b.spent > b.monthlyLimit) {
      notifications.push({
        id: `budget-${b.id}`,
        icon: <DollarSign className="h-4 w-4 text-orange-500" />,
        message: `Orçamento estourado: ${b.category}`,
        href: '/financeiro',
        type: 'budget',
      });
    }
  }

  const hasJournalToday = journal.some(j => j.entryDate === today);
  if (!hasJournalToday) {
    notifications.push({
      id: `journal-${today}`,
      icon: <BookOpen className="h-4 w-4 text-blue-500" />,
      message: 'Diário de hoje ainda não preenchido',
      href: '/diario',
      type: 'journal',
    });
  }

  for (const c of captures) {
    if (c.status === 'inbox' && daysDiff(c.createdAt) >= 7) {
      notifications.push({
        id: `capture-${c.id}`,
        icon: <Inbox className="h-4 w-4 text-purple-500" />,
        message: `Capture não processada: ${c.title || c.content.slice(0, 40)}`,
        href: '/inbox',
        type: 'capture',
      });
    }
  }

  return notifications;
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [tasks, budgets, journal, captures] = await Promise.all([
        fetch('/api/tasks').then(r => r.json()),
        fetch('/api/budgets').then(r => r.json()),
        fetch('/api/journal').then(r => r.json()),
        fetch('/api/captures').then(r => r.json()),
      ]);
      setNotifications(buildNotifications(tasks, budgets, journal, captures));
      setReadIds(getReadIds());
    } catch {
      // silently fail
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const unread = notifications.filter(n => !readIds.has(n.id));

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (v) {
      const ids = notifications.map(n => n.id);
      markAllRead(ids);
      setReadIds(new Set(ids));
    }
  }

  function handleNotificationClick(id: string) {
    markRead(id);
    setReadIds(prev => new Set([...prev, id]));
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-7 w-7 shrink-0">
          <Bell className="h-3.5 w-3.5 text-muted-foreground" />
          <AnimatePresence>
            {unread.length > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold text-destructive-foreground"
              >
                {unread.length > 9 ? '9+' : unread.length}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="text-sm font-semibold">Notificações</span>
          {unread.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {unread.length} nova{unread.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <ScrollArea className="h-[320px]">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              Carregando...
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Check className="h-8 w-8 mb-2 text-green-500" />
              <span className="text-sm">Tudo em dia!</span>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {notifications.map((n, i) => {
                const isRead = readIds.has(n.id);
                return (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.2 }}
                  >
                    <Link
                      href={n.href}
                      onClick={() => handleNotificationClick(n.id)}
                      className={cn(
                        'flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50 border-b border-border last:border-0',
                        isRead && 'opacity-50'
                      )}
                    >
                      <span className="mt-0.5 shrink-0">{n.icon}</span>
                      <span className="text-sm text-foreground leading-snug flex-1">{n.message}</span>
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
