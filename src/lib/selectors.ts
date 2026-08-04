import {
  defaultDayAssignment,
  splitForDays,
} from '../data/presets';
import { habitState, type HabitState } from './habits';
import { isoWeekday, today as todayKey, weekDays, weekKey } from './date';
import { macroTargets, sumAlcohol, sumMeals } from './nutrition';
import type {
  AppState,
  DayKey,
  SplitKind,
  WorkoutSession,
  WorkoutTemplate,
} from './types';

/** Hoeveel dagen wil de gebruiker deze week trainen? Standaard 6 (§8.2). */
export function availableDaysForWeek(state: AppState, week = weekKey()): number {
  const checkIn = state.checkIns.find((c) => c.week === week);
  return checkIn ? checkIn.availableDays : 6;
}

export function splitForWeek(state: AppState, week = weekKey()): SplitKind {
  return splitForDays(availableDaysForWeek(state, week));
}

export function templatesForSplit(
  state: AppState,
  split: SplitKind,
): WorkoutTemplate[] {
  return state.templates
    .filter((t) => t.split === split)
    .sort((a, b) => a.order - b.order);
}

export interface PlannedDay {
  day: DayKey;
  weekday: number;
  template: WorkoutTemplate | null;
  session: WorkoutSession | null;
  isTeachingDay: boolean;
  /** Voorkeurstijdstip, afgeleid van het lesrooster (§3D). */
  preferredTime: 'ochtend' | 'avond' | 'flexibel';
}

/**
 * Het weekschema. De verdeling volgt uit hoeveel dagen de gebruiker bij de
 * check-in haalbaar noemde — geen vast schema dat je "faalt" als het niet lukt.
 */
export function weekSchedule(state: AppState, anchor: DayKey = todayKey()): PlannedDay[] {
  const week = weekKey(anchor);
  const split = splitForWeek(state, week);
  const templates = templatesForSplit(state, split);
  const days = weekDays(anchor);

  const stored = state.weekPlans.find((p) => p.week === week && p.split === split);
  const assignedWeekdays = stored
    ? stored.assignments.map((a) => a.day)
    : defaultDayAssignment(availableDaysForWeek(state, week));

  return days.map((day) => {
    const weekday = isoWeekday(day);
    const slot = assignedWeekdays.indexOf(weekday);
    const template =
      slot >= 0 && slot < templates.length
        ? stored
          ? state.templates.find(
              (t) => t.id === stored.assignments[slot]?.templateId,
            ) ?? templates[slot]
          : templates[slot]
        : null;
    const session =
      state.sessions.find((s) => s.day === day && s.status !== 'gemist') ?? null;
    const isTeachingDay = state.profile.teachingDays.includes(weekday);

    return {
      day,
      weekday,
      template,
      session,
      isTeachingDay,
      preferredTime: isTeachingDay
        ? state.profile.trainingTimeTeachingDay
        : state.profile.trainingTimeOtherDay,
    };
  });
}

export function planForDay(state: AppState, day: DayKey = todayKey()): PlannedDay {
  const week = weekSchedule(state, day);
  return (
    week.find((d) => d.day === day) ?? {
      day,
      weekday: isoWeekday(day),
      template: null,
      session: null,
      isTeachingDay: state.profile.teachingDays.includes(isoWeekday(day)),
      preferredTime: 'flexibel',
    }
  );
}

/* ---------------------------------------------------------- dagtotalen */

export function mealsOn(state: AppState, day: DayKey) {
  return state.meals.filter((m) => m.day === day);
}

export function alcoholOn(state: AppState, day: DayKey) {
  return state.alcohol.filter((a) => a.day === day);
}

export function dailyTotals(state: AppState, day: DayKey) {
  const meals = sumMeals(mealsOn(state, day));
  const alcohol = sumAlcohol(alcoholOn(state, day));
  return {
    ...meals,
    kcal: meals.kcal + alcohol.kcal,
    alcoholKcal: alcohol.kcal,
    alcoholGlasses: alcohol.glasses,
    foodKcal: meals.kcal,
  };
}

export function stepsOn(state: AppState, day: DayKey): number {
  return state.steps.find((s) => s.day === day)?.steps ?? 0;
}

export function supplementsOn(state: AppState, day: DayKey) {
  return state.supplementLogs.find((s) => s.day === day)?.taken ?? [];
}

/* ------------------------------------------ automatisch afgevinkte dagen */

/**
 * Sommige gewoontes zijn al af te leiden uit andere modules. Die vinken we
 * automatisch af — elke tik die de gebruiker niet hoeft te doen, is winst.
 */
export function autoDaysFor(
  state: AppState,
  source: NonNullable<AppState['habits'][number]['autoSource']>,
): Set<DayKey> {
  const days = new Set<DayKey>();

  if (source === 'training') {
    for (const s of state.sessions) {
      if (s.status === 'voltooid' || s.status === 'minimaal') days.add(s.day);
    }
    // Cardio telt ook als "vandaag bewogen met opzet".
    for (const c of state.cardio) days.add(c.day);
  }

  if (source === 'eiwit') {
    const target = macroTargets(state.profile).proteinG;
    const byDay = new Map<DayKey, number>();
    for (const m of state.meals) {
      byDay.set(m.day, (byDay.get(m.day) ?? 0) + m.proteinG * m.servings);
    }
    for (const [day, protein] of byDay) {
      if (protein >= target) days.add(day);
    }
  }

  if (source === 'supplementen') {
    // Creatine is de hoogste prioriteit (§8.5) en is ook de minimale versie.
    for (const log of state.supplementLogs) {
      if (log.taken.includes('creatine')) days.add(log.day);
    }
  }

  if (source === 'stappen') {
    for (const s of state.steps) {
      if (s.steps >= state.profile.stepGoal) days.add(s.day);
    }
  }

  return days;
}

export function habitStates(state: AppState, day: DayKey = todayKey()): HabitState[] {
  return state.habits
    .filter((h) => !h.archived)
    .map((habit) =>
      habitState(
        habit,
        state.habitLogs,
        habit.autoSource ? autoDaysFor(state, habit.autoSource) : new Set<DayKey>(),
        day,
      ),
    );
}

/* ------------------------------------------------------------- weekcijfers */

export function weekMeals(state: AppState, anchor: DayKey = todayKey()) {
  const days = new Set(weekDays(anchor));
  return state.meals.filter((m) => days.has(m.day));
}

export function weekAlcohol(state: AppState, anchor: DayKey = todayKey()) {
  const days = new Set(weekDays(anchor));
  return state.alcohol.filter((a) => days.has(a.day));
}

export function weekCardio(state: AppState, anchor: DayKey = todayKey()) {
  const days = new Set(weekDays(anchor));
  return state.cardio.filter((c) => days.has(c.day));
}

export function weekSessions(state: AppState, anchor: DayKey = todayKey()) {
  const days = new Set(weekDays(anchor));
  return state.sessions.filter((s) => days.has(s.day));
}

export function completedSessionsThisWeek(
  state: AppState,
  anchor: DayKey = todayKey(),
): number {
  return weekSessions(state, anchor).filter(
    (s) => s.status === 'voltooid' || s.status === 'minimaal',
  ).length;
}

export function needsCheckIn(state: AppState, anchor: DayKey = todayKey()): boolean {
  return !state.checkIns.some((c) => c.week === weekKey(anchor));
}
