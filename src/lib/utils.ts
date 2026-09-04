import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function addDays(date: Date | string, days: number): string {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
