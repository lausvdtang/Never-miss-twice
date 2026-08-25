import { defaultDayAssignment, splitForDays } from './presets.js';
import { habitState } from './habits.js';
import { isoWeekday, lastDays, today as todayKey, weekDays, weekKey } from './date.js';
import { macroTargets, sumAlcohol, sumMeals } from './nutrition.js';

/** Hoeveel dagen wil de gebruiker deze week trainen? Standaard 6 (§8.2). */
export function availableDaysForWeek(state, week = weekKey()) {
  const checkIn = state.checkIns.find((c) => c.week === week);
  return checkIn ? checkIn.availableDays : 6;
}

export function splitForWeek(state, week = weekKey()) {
  return splitForDays(availableDaysForWeek(state, week));
}

export function templatesForSplit(state, split) {
  return state.templates.filter((t) => t.split === split).sort((a, b) => a.order - b.order);
}

/**
 * Het weekschema. De verdeling volgt uit hoeveel dagen de gebruiker bij de
 * check-in haalbaar noemde — geen vast schema dat je "faalt" als het niet lukt.
 */
export function weekSchedule(state, anchor = todayKey()) {
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
    let template = null;
    if (slot >= 0 && slot < templates.length) {
      template = stored
        ? state.templates.find((t) => t.id === stored.assignments[slot]?.templateId) ??
          templates[slot]
        : templates[slot];
    }
    const session = state.sessions.find((s) => s.day === day && s.status !== 'gemist') ?? null;
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

export function planForDay(state, day = todayKey()) {
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

export function mealsOn(state, day) {
  return state.meals.filter((m) => m.day === day);
}

export function alcoholOn(state, day) {
  return state.alcohol.filter((a) => a.day === day);
}

export function dailyTotals(state, day) {
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

export function stepsOn(state, day) {
  return state.steps.find((s) => s.day === day)?.steps ?? 0;
}

export function supplementsOn(state, day) {
  return state.supplementLogs.find((s) => s.day === day)?.taken ?? [];
}

/* ------------------------------------------ automatisch afgevinkte dagen */

/**
 * Sommige gewoontes zijn al af te leiden uit andere modules. Die vinken we
 * automatisch af — elke tik die de gebruiker niet hoeft te doen, is winst.
 */
export function autoDaysFor(state, source) {
  const days = new Set();

  if (source === 'training') {
    for (const s of state.sessions) {
      if (s.status === 'voltooid' || s.status === 'minimaal') days.add(s.day);
    }
    // Cardio telt ook als "vandaag bewogen met opzet".
    for (const c of state.cardio) days.add(c.day);
  }

  if (source === 'eiwit') {
    const target = macroTargets(state.profile).proteinG;
    const byDay = new Map();
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

export function habitStates(state, day = todayKey()) {
  return state.habits
    .filter((h) => !h.archived)
    .map((habit) =>
      habitState(
        habit,
        state.habitLogs,
        habit.autoSource ? autoDaysFor(state, habit.autoSource) : new Set(),
        day,
      ),
    );
}

/* ------------------------------------------------------------- weekcijfers */

export function weekMeals(state, anchor = todayKey()) {
  const days = new Set(weekDays(anchor));
  return state.meals.filter((m) => days.has(m.day));
}

export function weekAlcohol(state, anchor = todayKey()) {
  const days = new Set(weekDays(anchor));
  return state.alcohol.filter((a) => days.has(a.day));
}

export function weekCardio(state, anchor = todayKey()) {
  const days = new Set(weekDays(anchor));
  return state.cardio.filter((c) => days.has(c.day));
}

export function weekSessions(state, anchor = todayKey()) {
  const days = new Set(weekDays(anchor));
  return state.sessions.filter((s) => days.has(s.day));
}

export function completedSessionsThisWeek(state, anchor = todayKey()) {
  return weekSessions(state, anchor).filter(
    (s) => s.status === 'voltooid' || s.status === 'minimaal',
  ).length;
}

export function needsCheckIn(state, anchor = todayKey()) {
  return !state.checkIns.some((c) => c.week === weekKey(anchor));
}

/* ------------------------------------------------------------ gezonde dagen */

export function isHealthyDay(state, day) {
  return (state.healthyDays ?? []).includes(day);
}

/**
 * Markeringen voor de kalender: welke dagen zijn groen, en op welke dagen is
 * er getraind (inclusief cardio en de minimale versie).
 */
export function calendarMarks(state) {
  const marks = new Map();
  const touch = (day) => {
    if (!marks.has(day)) marks.set(day, { healthy: false, trained: false });
    return marks.get(day);
  };

  for (const day of state.healthyDays ?? []) touch(day).healthy = true;
  for (const s of state.sessions) {
    if (s.status === 'voltooid' || s.status === 'minimaal') touch(s.day).trained = true;
  }
  for (const c of state.cardio) touch(c.day).trained = true;

  return marks;
}

/** Aantal groene dagen in de laatste `days` dagen, inclusief vandaag. */
export function healthyDayCount(state, days = 30, anchor = todayKey()) {
  const window = new Set(lastDays(days, anchor));
  return (state.healthyDays ?? []).filter((d) => window.has(d)).length;
}
