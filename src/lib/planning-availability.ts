export type MinuteInterval = { start: number; end: number };

/** Union busy intervals before subtracting them from the displayed window. */
export function freeIntervals(busy: MinuteInterval[], from: number, to: number): MinuteInterval[] {
  const intervals = busy.filter(item => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start)
    .map(item => ({ start: Math.max(from, item.start), end: Math.min(to, item.end) }))
    .filter(item => item.end > item.start).sort((a, b) => a.start - b.start);
  const free: MinuteInterval[] = [];
  let cursor = from;
  for (const item of intervals) {
    if (item.start > cursor) free.push({ start: cursor, end: item.start });
    cursor = Math.max(cursor, item.end);
  }
  if (cursor < to) free.push({ start: cursor, end: to });
  return free;
}

export function minutesOnDay(value: string, day: string): number {
  const date = new Date(value);
  const start = new Date(`${day}T00:00:00`);
  const next = new Date(start); next.setDate(next.getDate() + 1);
  if (date < start) return 0;
  if (date >= next) return 1440;
  return date.getHours() * 60 + date.getMinutes();
}

export function clockLabel(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
