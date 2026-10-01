export function planningTimeZone(input: { preferredTimeZone?: string; previousTimeZone?: string; previousStartAt?: string }) {
  const zone = input.previousStartAt && input.previousTimeZone ? input.previousTimeZone : input.preferredTimeZone || 'America/Sao_Paulo';
  new Intl.DateTimeFormat('en', { timeZone: zone });
  return zone;
}

function parts(instant: string | number, timeZone: string) {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new Error('Horário inválido.');
  const values = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const value = (type: string) => values.find(part => part.type === type)!.value;
  return { date: `${value('year')}-${value('month')}-${value('day')}`, time: `${value('hour')}:${value('minute')}`, second: value('second') };
}

export function planningClockParts(instant: string, timeZone: string) {
  const value = parts(instant, timeZone);
  return { date: value.date, time: value.time };
}

/** Civil-clock conversion never depends on the browser's timezone. */
export function planningStartAt(day: string, time: string, timeZone: string, previousStartAt?: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Dia ou horário inválido.');
  const wall = Date.parse(`${day}T${time}:00Z`);
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 10) !== day) throw new Error('Dia inválido.');
  new Intl.DateTimeFormat('en', { timeZone });
  if (previousStartAt) {
    const previous = parts(previousStartAt, timeZone);
    if (previous.date === day && previous.time === time) return new Date(previousStartAt).toISOString();
  }
  // Offsets before and after a transition identify both sides of a repeated hour.
  const offsets = new Set<number>();
  for (let hour = -36; hour <= 36; hour += 3) {
    const probe = wall + hour * 3600000;
    const local = parts(probe, timeZone);
    offsets.add(Date.parse(`${local.date}T${local.time}:${local.second}Z`) - probe);
  }
  const matches = [...offsets].map(offset => wall - offset).filter(instant => {
    const local = parts(instant, timeZone);
    return local.date === day && local.time === time;
  }).sort((a, b) => a - b);
  if (!matches.length) throw new Error('Esse horário não existe no fuso selecionado. Escolha outro horário.');
  return new Date(matches[0]).toISOString();
}
