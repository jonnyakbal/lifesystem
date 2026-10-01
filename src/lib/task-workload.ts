import type { StageDef, TaskPlanning } from '@/types';
import { isTaskCompleted } from './task-stages';
import { workWindowOnDay, type PlanningPreferences } from './planning-preferences';

export interface WorkloadTask {
  id: string; status: string; completedAt?: string; dueDate?: string;
  priority: 'normal' | 'important' | 'urgent'; projectId?: string; pillarId?: string;
  planning?: TaskPlanning;
  estimatedMinutes?: number;
}
function zonedDate(time: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(time));
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}
export function weekDates(date: string): string[] {
  const day = new Date(`${date}T12:00:00`);
  day.setDate(day.getDate() - (day.getDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(day); next.setDate(next.getDate() + index);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
  });
}
export function calculateWorkload<T extends WorkloadTask>(tasks: T[], stages: StageDef[], days: string[], preferences?: PlanningPreferences) {
  const open = tasks.filter(task => !isTaskCompleted(task, stages));
  const inWeek = open.filter(task => task.dueDate && days.includes(task.dueDate));
  const undated = open.filter(task => !task.dueDate);
  const outside = open.filter(task => task.dueDate && !days.includes(task.dueDate));
  const distribution = days.map(date => {
    const items = inWeek.filter(task => task.dueDate === date);
    const blocks = open.flatMap(task => {
      const plan = task.planning;
      if (!plan?.startAt || !plan.endAt) return [];
      const start = Date.parse(plan.startAt), end = Date.parse(plan.endAt);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
      let startDate: string;
      try {
        startDate = zonedDate(start, plan.timeZone);
      } catch { return []; }
      return startDate === date ? [{ id: task.id, start, end }] : [];
    });
    const estimated = items.filter(task => typeof task.estimatedMinutes === 'number' && Number.isFinite(task.estimatedMinutes) && task.estimatedMinutes > 0);
    const window = preferences ? workWindowOnDay(date, preferences) : null;
    return { date, tasks: items, urgent: items.filter(task => task.priority === 'urgent').length, blocks: blocks.length, hours: blocks.reduce((sum, block) => sum + (block.end - block.start) / 3600000, 0),
      estimatedMinutes: estimated.reduce((sum, task) => sum + task.estimatedMinutes!, 0), unestimated: items.length - estimated.length,
      capacityMinutes: preferences ? (window ? window.end - window.start : 0) : null };
  });
  // Count pairs across the complete week, including blocks spanning midnight.
  const weekStart = days[0], weekEnd = days[days.length - 1];
  const intervals = open.flatMap(task => {
    const plan = task.planning;
    if (!plan?.startAt || !plan.endAt) return [];
    const start = Date.parse(plan.startAt), end = Date.parse(plan.endAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
    try {
      if (zonedDate(start, plan.timeZone) > weekEnd || zonedDate(end - 1, plan.timeZone) < weekStart) return [];
    } catch { return []; }
    return [{ start, end, timeZone: plan.timeZone }];
  });
  let overlaps = 0;
  intervals.forEach((block, index) => intervals.slice(index + 1).forEach(other => {
    const start = Math.max(block.start, other.start), end = Math.min(block.end, other.end);
    if (start < end && [block.timeZone, other.timeZone].some(zone => zonedDate(start, zone) <= weekEnd && zonedDate(end - 1, zone) >= weekStart)) overlaps++;
  }));
  return { open, inWeek, undated, outside, distribution, overlaps, hours: distribution.reduce((sum, day) => sum + day.hours, 0),
    estimatedMinutes: distribution.reduce((sum, day) => sum + day.estimatedMinutes, 0), unestimated: distribution.reduce((sum, day) => sum + day.unestimated, 0),
    capacityMinutes: preferences ? distribution.reduce((sum, day) => sum + day.capacityMinutes!, 0) : null };
}
