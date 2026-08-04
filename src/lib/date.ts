import type { DayKey, WeekKey } from './types';

export const DAY_NAMES = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
export const DAY_NAMES_LONG = [
  'maandag',
  'dinsdag',
  'woensdag',
  'donderdag',
  'vrijdag',
  'zaterdag',
  'zondag',
];

/** Lokale dagsleutel, niet UTC — anders schuift "vandaag" 's avonds op. */
export function dayKey(d: Date = new Date()): DayKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDay(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: DayKey, delta: number): DayKey {
  const d = parseDay(key);
  d.setDate(d.getDate() + delta);
  return dayKey(d);
}

export function today(): DayKey {
  return dayKey();
}

export function yesterday(): DayKey {
  return addDays(today(), -1);
}

/** ISO-weekdag: 1 = maandag ... 7 = zondag. */
export function isoWeekday(key: DayKey): number {
  const wd = parseDay(key).getDay();
  return wd === 0 ? 7 : wd;
}

/** ISO-weeksleutel, bijv. "2026-W32". */
export function weekKey(key: DayKey = today()): WeekKey {
  const d = parseDay(key);
  // Verschuif naar donderdag van deze week: dat bepaalt het ISO-jaar.
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const isoYear = target.getFullYear();
  const jan4 = new Date(isoYear, 0, 4);
  const jan4DayNr = (jan4.getDay() + 6) % 7;
  const week1Monday = new Date(isoYear, 0, 4 - jan4DayNr);
  const diffDays = Math.round(
    (target.getTime() - week1Monday.getTime()) / 86400000,
  );
  const week = Math.floor(diffDays / 7) + 1;
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/** Maandag van de week waarin `key` valt. */
export function startOfWeek(key: DayKey = today()): DayKey {
  return addDays(key, -(isoWeekday(key) - 1));
}

/** Alle 7 dagsleutels van de week waarin `key` valt (ma → zo). */
export function weekDays(key: DayKey = today()): DayKey[] {
  const monday = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** De laatste `n` dagen tot en met `key`, oudste eerst. */
export function lastDays(n: number, key: DayKey = today()): DayKey[] {
  return Array.from({ length: n }, (_, i) => addDays(key, -(n - 1 - i)));
}

export function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000);
}

export function formatDay(key: DayKey): string {
  const d = parseDay(key);
  return `${DAY_NAMES_LONG[isoWeekday(key) - 1]} ${d.getDate()} ${
    [
      'januari',
      'februari',
      'maart',
      'april',
      'mei',
      'juni',
      'juli',
      'augustus',
      'september',
      'oktober',
      'november',
      'december',
    ][d.getMonth()]
  }`;
}

export function formatDayShort(key: DayKey): string {
  const d = parseDay(key);
  return `${DAY_NAMES[isoWeekday(key) - 1]} ${d.getDate()}/${d.getMonth() + 1}`;
}

export function hoursSince(iso: string, now: Date = new Date()): number {
  return (now.getTime() - new Date(iso).getTime()) / 3600000;
}

/** "vanochtend" / "vanmiddag" / "vanavond" — voor toon in de copy. */
export function partOfDay(now: Date = new Date()): 'ochtend' | 'middag' | 'avond' {
  const h = now.getHours();
  if (h < 12) return 'ochtend';
  if (h < 18) return 'middag';
  return 'avond';
}

export function greeting(now: Date = new Date()): string {
  const p = partOfDay(now);
  if (p === 'ochtend') return 'Goedemorgen';
  if (p === 'middag') return 'Goedemiddag';
  return 'Goedenavond';
}
