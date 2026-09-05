import { test, expect } from '@playwright/test';
import { addDays, sanitizeHtml, todayStr } from '@/lib/utils';
import { nextDueDate } from '@/lib/recurring';

test.describe('Domain utilities', () => {
  test('formats date-only values using local calendar components', () => {
    const date = new Date(2026, 0, 5, 23, 30);
    expect(todayStr(date)).toBe('2026-01-05');
    expect(addDays('2026-01-05', 1)).toBe('2026-01-06');
  });

  test('clamps monthly recurring tasks to the target month', () => {
    expect(nextDueDate('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(nextDueDate('2028-01-31', 'monthly')).toBe('2028-02-29');
  });

  test('removes executable markup and unsafe links', () => {
    const sanitized = sanitizeHtml(
      '<img src=x onerror="alert(1)"><a href="javascript:alert(1)">click</a><strong>safe</strong>'
    );
    expect(sanitized).not.toContain('onerror');
    expect(sanitized).not.toContain('javascript:');
    expect(sanitized).toContain('<strong>safe</strong>');
  });
});
