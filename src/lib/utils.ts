import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import DOMPurify from 'isomorphic-dompurify';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function todayStr(date = new Date()): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function addDays(date: Date | string, days: number): string {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : new Date(date);
  d.setDate(d.getDate() + days);
  return todayStr(d);
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function sanitizeHtml(value: string): string {
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [
      'a', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'h1', 'h2', 'h3',
      'hr', 'img', 'input', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'table',
      'tbody', 'td', 'th', 'thead', 'tr', 'ul',
    ],
    ALLOWED_ATTR: [
      'alt', 'class', 'checked', 'colspan', 'disabled', 'href', 'rel', 'src',
      'target', 'type', 'width', 'height',
    ],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['form', 'iframe', 'object', 'script', 'style', 'svg'],
    FORBID_ATTR: ['formaction', 'onerror', 'onclick', 'onload', 'style'],
  });
}
