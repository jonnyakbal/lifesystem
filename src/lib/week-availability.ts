import { listGoogleCalendarEvents, type GoogleCalendarEvent } from '@/lib/google-calendar';
import { clockLabel, freeIntervals, minutesOnDay, type MinuteInterval } from '@/lib/planning-availability';
import { DEFAULT_PLANNING_PREFERENCES, planningPreferencesSchema, workWindowOnDay } from '@/lib/planning-preferences';
import { storage } from '@/lib/storage';
import { isTaskCompleted, resolveTaskStages } from '@/lib/task-stages';
import { weekDates } from '@/lib/task-workload';
import { DEFAULT_STAGES } from '@/lib/default-stages';
import type { StageConfig, Task } from '@/types';

type TimedBlock = { start: string; end: string };

function intervalOnDay(block: TimedBlock, date: string, timeZone: string): MinuteInterval[] {
  const start = minutesOnDay(block.start, date, timeZone);
  const end = minutesOnDay(block.end, date, timeZone);
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? [{ start, end }] : [];
}

function showInterval(interval: MinuteInterval) {
  return { start: clockLabel(interval.start), end: clockLabel(interval.end) };
}

export async function getWeekAvailability(
  date: string,
  minimumMinutes: number,
  readCalendar = listGoogleCalendarEvents,
) {
  const dates = weekDates(date);
  const [record, tasks, configs] = await Promise.all([
    storage.getById<{ id: string; preferences: unknown }>('planning_preferences', 'default'),
    storage.getAll<Task>('tasks'),
    storage.getAll<StageConfig>('stage-configs'),
  ]);
  const preferences = record ? planningPreferencesSchema.parse(record.preferences) : DEFAULT_PLANNING_PREFERENCES;
  const { timeZone } = preferences;
  const stages = resolveTaskStages(configs.find(config => config.scope === 'tasks')?.stages ?? DEFAULT_STAGES.tasks, tasks);
  const blocks = tasks.flatMap(task => {
    const { startAt, endAt } = task.planning ?? {};
    return startAt && endAt && !isTaskCompleted(task, stages) ? [{ start: startAt, end: endAt }] : [];
  });

  let events: GoogleCalendarEvent[] | null;
  try {
    // The padded UTC range covers both ends of the civil week in any supported timezone.
    const from = Date.parse(dates[0]) - 86_400_000;
    const to = Date.parse(dates[6]) + 2 * 86_400_000;
    events = await readCalendar(new Date(from).toISOString(), new Date(to).toISOString());
  } catch {
    events = null;
  }

  return {
    timeZone,
    calendarStatus: events ? 'verified' : 'unavailable',
    preferencesSource: record ? 'configured' : 'default',
    days: dates.map(day => {
      const window = workWindowOnDay(day, preferences);
      const localBusy = blocks.flatMap(block => intervalOnDay(block, day, timeZone));
      const googleBusy = events?.flatMap(event => {
        if (event.busy === false) return [];
        if (event.allDay) return event.start <= day && day < event.end ? [{ start: 0, end: 1440 }] : [];
        return intervalOnDay(event, day, timeZone);
      });
      const freeWindows = !window ? [] : googleBusy
        ? freeIntervals([...localBusy, ...googleBusy], window.start, window.end)
          .filter(interval => interval.end - interval.start >= minimumMinutes)
          .map(showInterval)
        : null;
      return { date: day, workWindow: window ? showInterval(window) : null, freeWindows };
    }),
  };
}
