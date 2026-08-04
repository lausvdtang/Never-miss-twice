import { addDays, daysBetween, isoWeekday, today as todayKey } from './date';
import type { DayKey, Habit, HabitLog } from './types';

/** Hoe ver we terugkijken bij het berekenen van streaks. */
const LOOKBACK_DAYS = 180;

export type HabitStatus = 'nieuw' | 'op_dreef' | 'een_gemist' | 'herstel';

export interface HabitState {
  habit: Habit;
  /**
   * Streak die één losse gemiste dag overleeft. §8.7: één gemiste dag heeft
   * geen wezenlijke invloed op gewoontevorming, dus die breekt hier niets.
   * Twee op rij wél — dat is precies het signaal waar de app op ingrijpt.
   */
  streak: number;
  /** Langste streak ooit, voor de context op het gewoontescherm. */
  bestStreak: number;
  /** Is vandaag een dag waarop deze gewoonte telt? */
  activeToday: boolean;
  /** Vandaag al afgevinkt? */
  doneToday: boolean;
  /** Alleen de minimale versie gedaan vandaag? Telt volwaardig mee. */
  minimalToday: boolean;
  /** Aantal actieve dagen op rij vóór vandaag zonder log. */
  missedInARow: number;
  status: HabitStatus;
  /** Aantal keer afgevinkt in de laatste 30 actieve dagen. */
  last30: number;
  /**
   * Vaste reeks van 14 actieve dagen, oudste eerst — voor de streakbalk.
   * Dagen van vóór het aanmaken van de gewoonte blijven staan (met
   * `beforeStart`), zodat de balk altijd dezelfde breedte en ritme houdt in
   * plaats van één brede blok te worden bij een nieuwe gewoonte.
   */
  recent: {
    day: DayKey;
    done: boolean;
    minimal: boolean;
    isToday: boolean;
    beforeStart: boolean;
  }[];
}

export function isActiveOn(habit: Habit, day: DayKey): boolean {
  if (!habit.activeDays || habit.activeDays.length === 0) return true;
  return habit.activeDays.includes(isoWeekday(day));
}

/**
 * Bepaalt de volledige staat van één gewoonte.
 *
 * `autoDays` bevat dagen die door een andere module al zijn afgevinkt
 * (training gedaan, eiwitdoel gehaald, supplementen genomen, stappen gehaald),
 * zodat de gebruiker daar niet nóg een keer op hoeft te tikken.
 */
export function habitState(
  habit: Habit,
  logs: HabitLog[],
  autoDays: Set<DayKey> = new Set(),
  today: DayKey = todayKey(),
): HabitState {
  const byDay = new Map<DayKey, HabitLog>();
  for (const log of logs) {
    if (log.habitId === habit.id) byDay.set(log.day, log);
  }

  const createdDay = habit.createdAt.slice(0, 10);
  const isDone = (day: DayKey) => byDay.has(day) || autoDays.has(day);
  const isMinimal = (day: DayKey) =>
    byDay.get(day)?.completion === 'minimaal' && !autoDays.has(day);

  // Actieve dagen, meest recent eerst, tot aan de aanmaakdatum van de gewoonte.
  const activeDays: DayKey[] = [];
  for (let i = 0; i < LOOKBACK_DAYS; i++) {
    const day = addDays(today, -i);
    if (day < createdDay) break;
    if (isActiveOn(habit, day)) activeDays.push(day);
  }

  const activeToday = activeDays[0] === today;
  const doneToday = isDone(today);
  const minimalToday = isMinimal(today);

  // Gemiste actieve dagen direct vóór vandaag. Vandaag zelf telt nooit als
  // gemist — de dag is nog bezig.
  const before = activeToday ? activeDays.slice(1) : activeDays;
  let missedInARow = 0;
  for (const day of before) {
    if (isDone(day)) break;
    missedInARow++;
  }

  // Veerkrachtige streak: loop terug en tolereer één losse gemiste dag,
  // maar stop bij twee op rij.
  let streak = 0;
  let consecutiveMisses = 0;
  for (const day of activeDays) {
    if (isDone(day)) {
      streak++;
      consecutiveMisses = 0;
    } else if (day === today) {
      // Vandaag is nog niet voorbij; geen misser, geen streakpunt.
      continue;
    } else {
      consecutiveMisses++;
      if (consecutiveMisses >= 2) break;
    }
  }

  const last30 = activeDays.slice(0, 30).filter(isDone).length;

  // Vaste breedte van 14 actieve dagen, ook als de gewoonte jonger is.
  const strip: DayKey[] = [];
  for (let i = 0; strip.length < 14 && i < LOOKBACK_DAYS; i++) {
    const day = addDays(today, -i);
    if (isActiveOn(habit, day)) strip.push(day);
  }
  const recent = strip.reverse().map((day) => ({
    day,
    done: day >= createdDay && isDone(day),
    minimal: day >= createdDay && isMinimal(day),
    isToday: day === today,
    beforeStart: day < createdDay,
  }));

  let status: HabitStatus = 'op_dreef';
  if (missedInARow >= 2) status = 'herstel';
  else if (missedInARow === 1) status = 'een_gemist';
  else if (streak === 0 && activeDays.filter(isDone).length === 0) status = 'nieuw';

  return {
    habit,
    streak,
    bestStreak: bestStreak(habit, byDay, autoDays, today),
    activeToday,
    doneToday,
    minimalToday,
    missedInARow,
    status,
    last30,
    recent,
  };
}

function bestStreak(
  habit: Habit,
  byDay: Map<DayKey, HabitLog>,
  autoDays: Set<DayKey>,
  today: DayKey,
): number {
  const createdDay = habit.createdAt.slice(0, 10);
  const span = Math.min(daysBetween(createdDay, today), LOOKBACK_DAYS);
  let best = 0;
  let run = 0;
  let misses = 0;
  for (let i = span; i >= 0; i--) {
    const day = addDays(today, -i);
    if (!isActiveOn(habit, day)) continue;
    if (byDay.has(day) || autoDays.has(day)) {
      run++;
      misses = 0;
      best = Math.max(best, run);
    } else if (day !== today) {
      misses++;
      if (misses >= 2) run = 0;
    }
  }
  return best;
}

export interface Nudge {
  /** Stabiele sleutel zodat een weggeklikte nudge niet blijft terugkomen. */
  key: string;
  tone: 'zacht' | 'herstel';
  title: string;
  body: string;
  /** Concrete micro-actie — nooit een abstract doel. */
  actionLabel: string;
  habitId: string;
}

/**
 * "Never miss twice" (§2, §8.7).
 *
 * Eén gemiste dag levert hooguit een milde opmerking op. Twee op rij is het
 * moment waarop de app ingrijpt — met de minimale versie als concrete actie,
 * in identity-taal, en zonder één woord dat naar schuldgevoel neigt.
 */
export function nudgeFor(state: HabitState, today: DayKey = todayKey()): Nudge | null {
  if (state.doneToday || !state.activeToday) return null;

  if (state.missedInARow >= 2) {
    return {
      key: `herstel_${state.habit.id}_${today}`,
      tone: 'herstel',
      title: `${state.habit.icon} Twee dagen overgeslagen`,
      body: `${state.habit.identity}. Dat blijft waar — vandaag is het moment om dat weer te laten zien. Doe de kleinste versie: ${state.habit.minimalVersion}`,
      actionLabel: 'Minimale versie — klaar',
      habitId: state.habit.id,
    };
  }

  if (state.missedInARow === 1) {
    return {
      key: `zacht_${state.habit.id}_${today}`,
      tone: 'zacht',
      title: `${state.habit.icon} Gisteren overgeslagen`,
      body: 'Eén dag maakt niets uit voor je gewoonte. Vandaag gewoon weer oppakken.',
      actionLabel: state.habit.name + ' afvinken',
      habitId: state.habit.id,
    };
  }

  return null;
}

/** Sorteert nudges: herstel eerst, want daar zit de echte interventie. */
export function collectNudges(
  states: HabitState[],
  dismissed: string[],
  today: DayKey = todayKey(),
): Nudge[] {
  const seen = new Set(dismissed);
  return states
    .map((s) => nudgeFor(s, today))
    .filter((n): n is Nudge => n !== null && !seen.has(n.key))
    .sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'herstel' ? -1 : 1));
}

/** Positieve bevestiging na het afvinken — identity-based (§8.7). */
export function completionMessage(habit: Habit, minimal: boolean): string {
  if (minimal) {
    return `${habit.identity}. Ook vandaag — de kleinste versie telt volledig mee.`;
  }
  return `${habit.identity}. Weer een dag waarop dat klopt.`;
}
