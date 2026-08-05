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

const MONTHS = [
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
];

/** Lokale dagsleutel ("2026-08-04"), niet UTC — anders schuift "vandaag" 's avonds op. */
export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, delta) {
  const d = parseDay(key);
  d.setDate(d.getDate() + delta);
  return dayKey(d);
}

export function today() {
  return dayKey();
}

/** ISO-weekdag: 1 = maandag ... 7 = zondag. */
export function isoWeekday(key) {
  const wd = parseDay(key).getDay();
  return wd === 0 ? 7 : wd;
}

/** ISO-weeksleutel, bijv. "2026-W32". */
export function weekKey(key = today()) {
  const d = parseDay(key);
  // Verschuif naar de donderdag van deze week: die bepaalt het ISO-jaar.
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const isoYear = target.getFullYear();
  const jan4 = new Date(isoYear, 0, 4);
  const jan4DayNr = (jan4.getDay() + 6) % 7;
  const week1Monday = new Date(isoYear, 0, 4 - jan4DayNr);
  const diffDays = Math.round((target.getTime() - week1Monday.getTime()) / 86400000);
  const week = Math.floor(diffDays / 7) + 1;
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/** Maandag van de week waarin `key` valt. */
export function startOfWeek(key = today()) {
  return addDays(key, -(isoWeekday(key) - 1));
}

/** Alle 7 dagsleutels van de week waarin `key` valt (ma → zo). */
export function weekDays(key = today()) {
  const monday = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function daysBetween(a, b) {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000);
}

export function formatDay(key) {
  const d = parseDay(key);
  return `${DAY_NAMES_LONG[isoWeekday(key) - 1]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatDayShort(key) {
  const d = parseDay(key);
  return `${DAY_NAMES[isoWeekday(key) - 1]} ${d.getDate()}/${d.getMonth() + 1}`;
}

export function hoursSince(iso, now = new Date()) {
  return (now.getTime() - new Date(iso).getTime()) / 3600000;
}

export function partOfDay(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return 'ochtend';
  if (h < 18) return 'middag';
  return 'avond';
}

export function greeting(now = new Date()) {
  const p = partOfDay(now);
  if (p === 'ochtend') return 'Goedemorgen';
  if (p === 'middag') return 'Goedemiddag';
  return 'Goedenavond';
}

/** "1 dag" / "3 dagen" — kleine dingen, maar ze vallen wél op. */
export function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Nederlandse decimale komma. */
export function nl(value, decimals = 1) {
  return value.toFixed(decimals).replace('.', ',');
}
