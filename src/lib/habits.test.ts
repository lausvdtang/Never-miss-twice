import { describe, expect, it } from 'vitest';
import { addDays } from './date';
import { collectNudges, habitState, nudgeFor } from './habits';
import type { Habit, HabitLog } from './types';

const TODAY = '2026-08-04';

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    identity: 'Ik ben iemand die traint',
    name: 'Training',
    anchor: 'Na het avondeten',
    minimalVersion: 'Alleen naar de sportschool rijden telt.',
    activeDays: [],
    icon: '🏋️',
    archived: false,
    createdAt: '2026-01-01T08:00:00.000Z',
    autoSource: null,
    ...overrides,
  };
}

function logs(habitId: string, days: string[]): HabitLog[] {
  return days.map((day) => ({
    habitId,
    day,
    completion: 'vol' as const,
    loggedAt: `${day}T18:00:00.000Z`,
  }));
}

describe('habitState — streaks', () => {
  it('telt aaneengesloten dagen', () => {
    const habit = makeHabit();
    const done = [addDays(TODAY, -2), addDays(TODAY, -1), TODAY];
    const state = habitState(habit, logs('h1', done), new Set(), TODAY);
    expect(state.streak).toBe(3);
    expect(state.doneToday).toBe(true);
    expect(state.missedInARow).toBe(0);
  });

  it('behandelt vandaag niet als gemist zolang de dag loopt', () => {
    const habit = makeHabit();
    const done = [addDays(TODAY, -2), addDays(TODAY, -1)];
    const state = habitState(habit, logs('h1', done), new Set(), TODAY);
    expect(state.doneToday).toBe(false);
    expect(state.missedInARow).toBe(0);
    expect(state.streak).toBe(2);
  });

  it('overleeft één losse gemiste dag — kern van never miss twice', () => {
    const habit = makeHabit();
    // gisteren gemist, eergisteren en daarvoor wel gedaan
    const done = [addDays(TODAY, -4), addDays(TODAY, -3), addDays(TODAY, -2)];
    const state = habitState(habit, logs('h1', done), new Set(), TODAY);
    expect(state.missedInARow).toBe(1);
    expect(state.streak).toBe(3);
    expect(state.status).toBe('een_gemist');
  });

  it('stopt de streak pas bij twee gemiste dagen op rij', () => {
    const habit = makeHabit();
    const done = [addDays(TODAY, -5), addDays(TODAY, -4), addDays(TODAY, -3)];
    const state = habitState(habit, logs('h1', done), new Set(), TODAY);
    expect(state.missedInARow).toBe(2);
    expect(state.streak).toBe(0);
    expect(state.status).toBe('herstel');
  });

  it('respecteert actieve dagen bij een gewoonte die niet elke dag telt', () => {
    // Alleen maandag (1) en woensdag (3). 2026-08-04 is een dinsdag.
    const habit = makeHabit({ activeDays: [1, 3] });
    const state = habitState(habit, [], new Set(), TODAY);
    expect(state.activeToday).toBe(false);
    expect(nudgeFor(state, TODAY)).toBeNull();
  });

  it('vinkt automatisch af op basis van een andere module', () => {
    const habit = makeHabit({ autoSource: 'training' });
    const auto = new Set([TODAY, addDays(TODAY, -1)]);
    const state = habitState(habit, [], auto, TODAY);
    expect(state.doneToday).toBe(true);
    expect(state.streak).toBe(2);
  });

  it('markeert de minimale versie als voltooid, niet als halve dag', () => {
    const habit = makeHabit();
    const state = habitState(
      habit,
      [{ habitId: 'h1', day: TODAY, completion: 'minimaal', loggedAt: TODAY }],
      new Set(),
      TODAY,
    );
    expect(state.doneToday).toBe(true);
    expect(state.minimalToday).toBe(true);
    expect(state.streak).toBe(1);
  });

  it('telt geen dagen mee van vóór het aanmaken van de gewoonte', () => {
    const habit = makeHabit({ createdAt: `${addDays(TODAY, -1)}T08:00:00.000Z` });
    const state = habitState(habit, [], new Set(), TODAY);
    expect(state.missedInARow).toBe(1);
  });

  it('houdt de streakbalk altijd 14 dagen breed', () => {
    // Een nieuwe gewoonte mag geen één brede balk worden; de dagen ervoor
    // krijgen `beforeStart` en tellen niet als misser.
    const verse = habitState(
      makeHabit({ createdAt: `${TODAY}T08:00:00.000Z` }),
      [],
      new Set(),
      TODAY,
    );
    expect(verse.recent).toHaveLength(14);
    expect(verse.recent.filter((d) => d.beforeStart)).toHaveLength(13);
    expect(verse.recent.at(-1)?.isToday).toBe(true);

    const oud = habitState(makeHabit(), [], new Set(), TODAY);
    expect(oud.recent).toHaveLength(14);
    expect(oud.recent.every((d) => !d.beforeStart)).toBe(true);
  });
});

describe('nudgeFor — never miss twice', () => {
  it('zwijgt als er niets gemist is', () => {
    const habit = makeHabit();
    const state = habitState(habit, logs('h1', [addDays(TODAY, -1)]), new Set(), TODAY);
    expect(nudgeFor(state, TODAY)).toBeNull();
  });

  it('is mild na één gemiste dag', () => {
    const habit = makeHabit();
    const state = habitState(habit, logs('h1', [addDays(TODAY, -2)]), new Set(), TODAY);
    const nudge = nudgeFor(state, TODAY)!;
    expect(nudge.tone).toBe('zacht');
    expect(nudge.body).toContain('Eén dag maakt niets uit');
  });

  it('grijpt in na twee gemiste dagen en biedt de minimale versie aan', () => {
    const habit = makeHabit();
    const state = habitState(habit, logs('h1', [addDays(TODAY, -3)]), new Set(), TODAY);
    const nudge = nudgeFor(state, TODAY)!;
    expect(nudge.tone).toBe('herstel');
    expect(nudge.body).toContain(habit.minimalVersion);
    expect(nudge.body).toContain(habit.identity);
  });

  it('zwijgt zodra de gewoonte vandaag is afgevinkt', () => {
    const habit = makeHabit();
    const state = habitState(habit, logs('h1', [addDays(TODAY, -3), TODAY]), new Set(), TODAY);
    expect(nudgeFor(state, TODAY)).toBeNull();
  });

  it('gebruikt nooit schuldgevoel-taal', () => {
    const habit = makeHabit();
    const verboden = ['gefaald', 'faalt', 'mislukt', 'slecht', 'schuld', 'moet je'];
    for (const offset of [-2, -3, -5]) {
      const state = habitState(habit, logs('h1', [addDays(TODAY, offset)]), new Set(), TODAY);
      const nudge = nudgeFor(state, TODAY);
      if (!nudge) continue;
      const text = `${nudge.title} ${nudge.body}`.toLowerCase();
      for (const woord of verboden) expect(text).not.toContain(woord);
    }
  });

  it('zet herstel-nudges vooraan en verbergt weggeklikte', () => {
    const a = habitState(makeHabit({ id: 'a' }), logs('a', [addDays(TODAY, -2)]), new Set(), TODAY);
    const b = habitState(makeHabit({ id: 'b' }), logs('b', [addDays(TODAY, -4)]), new Set(), TODAY);
    const nudges = collectNudges([a, b], [], TODAY);
    expect(nudges[0].tone).toBe('herstel');
    expect(nudges).toHaveLength(2);

    const filtered = collectNudges([a, b], [nudges[0].key], TODAY);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].tone).toBe('zacht');
  });
});
