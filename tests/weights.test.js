import { describe, expect, it } from 'vitest';
import {
  currentWeights,
  exerciseSessions,
  loggedWeights,
  weightsSummary,
} from '../app/progress.js';

function session(day, templateName, sets, status = 'voltooid') {
  return {
    id: `s_${day}`,
    day,
    templateId: 'tpl',
    templateName,
    status,
    startedAt: `${day}T08:00:00.000Z`,
    finishedAt: status === 'voltooid' ? `${day}T09:00:00.000Z` : null,
    sets: sets.map((s, i) => ({
      id: `set_${day}_${i}`,
      exerciseName: s.name ?? 'Squat',
      setIndex: s.setIndex ?? i,
      weightKg: s.weightKg,
      reps: s.reps,
      done: s.done ?? true,
      seeded: s.seeded,
      loggedAt: day,
    })),
  };
}

const SCHEDULE = [
  { name: 'Squat', sets: 3, repRange: '6-8', isKeystone: true },
  { name: 'Leg curl', sets: 3, repRange: '12' },
];

function row(rows, name) {
  return rows.find((r) => r.name === name);
}

describe('currentWeights', () => {
  it('geeft het zwaarste werkgewicht van de laatste sessie', () => {
    const sessions = [
      session('2026-08-01', 'Lower A', [
        { weightKg: 90, reps: 8 },
        { weightKg: 90, reps: 7 },
      ]),
      session('2026-08-08', 'Lower A', [
        { weightKg: 95, reps: 8 },
        { weightKg: 95, reps: 6 },
        { weightKg: 80, reps: 10 },
      ]),
    ];

    const squat = row(currentWeights(sessions, SCHEDULE), 'Squat');
    expect(squat.weightKg).toBe(95);
    expect(squat.day).toBe('2026-08-08');
    expect(squat.sessionCount).toBe(2);
  });

  it('telt alleen de reps op het topgewicht, niet de beste reps van de sessie', () => {
    // 12 reps op 60 kg mag niet als "95 kg × 12" in het overzicht komen.
    const sessions = [
      session('2026-08-08', 'Lower A', [
        { weightKg: 95, reps: 6 },
        { weightKg: 60, reps: 12 },
      ]),
    ];

    const squat = row(currentWeights(sessions, SCHEDULE), 'Squat');
    expect(squat.weightKg).toBe(95);
    expect(squat.reps).toBe(6);
    expect(squat.setCount).toBe(1);
  });

  it('geeft het verschil met de vorige sessie in kilo', () => {
    const sessions = [
      session('2026-08-01', 'Lower A', [{ weightKg: 80, reps: 8 }]),
      session('2026-08-08', 'Lower A', [{ weightKg: 82.5, reps: 8 }]),
    ];

    // 82.5 - 80 is in drijvende komma 2.4999…; dat mag niet doorlekken.
    expect(row(currentWeights(sessions, SCHEDULE), 'Squat').deltaKg).toBe(2.5);
  });

  it('laat deltaKg leeg zolang er niets te vergelijken valt', () => {
    const sessions = [session('2026-08-08', 'Lower A', [{ weightKg: 80, reps: 8 }])];
    expect(row(currentWeights(sessions, SCHEDULE), 'Squat').deltaKg).toBeNull();
  });

  it('vat dezelfde oefening uit verschillende schemas samen tot één regel', () => {
    const sessions = [
      session('2026-08-01', 'Lower A', [{ weightKg: 90, reps: 8 }]),
      session('2026-08-05', 'Full Body A', [{ weightKg: 100, reps: 6 }]),
    ];

    const rows = currentWeights(sessions, SCHEDULE).filter((r) => r.name === 'Squat');
    expect(rows).toHaveLength(1);
    expect(rows[0].weightKg).toBe(100);
  });

  it('negeert wat de app zelf heeft voorgesteld', () => {
    const sessions = [
      session('2026-08-01', 'Lower A', [{ weightKg: 80, reps: 8 }]),
      session('2026-08-08', 'Lower A', [
        { weightKg: 82.5, reps: 8, done: false, seeded: true },
      ]),
    ];

    const squat = row(currentWeights(sessions, SCHEDULE), 'Squat');
    expect(squat.weightKg).toBe(80);
    expect(squat.day).toBe('2026-08-01');
  });

  it('telt een sessie die nog op bezig staat gewoon mee', () => {
    const sessions = [
      session(
        '2026-08-08',
        'Lower A',
        [{ weightKg: 100, reps: 5, done: false, seeded: false }],
        'bezig',
      ),
    ];

    expect(row(currentWeights(sessions, SCHEDULE), 'Squat').weightKg).toBe(100);
  });

  it('slaat gemiste sessies over', () => {
    const sessions = [
      session('2026-08-01', 'Lower A', [{ weightKg: 80, reps: 8 }]),
      session('2026-08-08', 'Lower A', [{ weightKg: 200, reps: 1 }], 'gemist'),
    ];

    expect(row(currentWeights(sessions, SCHEDULE), 'Squat').weightKg).toBe(80);
  });

  it('houdt oefeningen zichtbaar die niet meer in het schema staan', () => {
    const sessions = [session('2026-08-01', 'Push A', [{ name: 'Dips', weightKg: 20, reps: 8 }])];

    const dips = row(currentWeights(sessions, SCHEDULE), 'Dips');
    expect(dips.scheduled).toBe(false);
    expect(dips.weightKg).toBe(20);
  });

  it('toont geplande oefeningen zonder geschiedenis met een leeg gewicht', () => {
    const rows = currentWeights([], SCHEDULE);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.weightKg === null && r.day === null)).toBe(true);
    expect(loggedWeights(rows)).toHaveLength(0);
  });

  it('houdt lichaamsgewicht (0 kg) apart van "nog niets gelogd"', () => {
    const sessions = [session('2026-08-01', 'Pull A', [{ name: 'Pull-ups', weightKg: 0, reps: 8 }])];

    const pullups = row(currentWeights(sessions, SCHEDULE), 'Pull-ups');
    expect(pullups.weightKg).toBe(0);
    expect(pullups.day).toBe('2026-08-01');
    expect(loggedWeights(currentWeights(sessions, SCHEDULE))).toHaveLength(1);
  });

  it('zet hoofdoefeningen bovenaan en de rest op alfabet', () => {
    const schedule = [
      { name: 'Zij-raise', sets: 3, repRange: '15' },
      { name: 'Bench press', sets: 3, repRange: '8' },
      { name: 'Squat', sets: 3, repRange: '6-8', isKeystone: true },
    ];

    expect(currentWeights([], schedule).map((r) => r.name)).toEqual([
      'Squat',
      'Bench press',
      'Zij-raise',
    ]);
  });
});

describe('weightsSummary', () => {
  it('zegt het zonder oordeel als er nog niets is', () => {
    expect(weightsSummary(currentWeights([], SCHEDULE))).toMatch(/Nog geen gewichten/);
  });

  it('telt hoeveel oefeningen zwaarder gingen', () => {
    const sessions = [
      session('2026-08-01', 'Lower A', [
        { name: 'Squat', weightKg: 80, reps: 8 },
        { name: 'Leg curl', weightKg: 40, reps: 12 },
      ]),
      session('2026-08-08', 'Lower A', [
        { name: 'Squat', weightKg: 85, reps: 8 },
        { name: 'Leg curl', weightKg: 40, reps: 12 },
      ]),
    ];

    expect(weightsSummary(currentWeights(sessions, SCHEDULE))).toBe(
      '2 oefeningen met een gewicht, waarvan 1 zwaarder dan de vorige keer.',
    );
  });
});

describe('exerciseSessions', () => {
  it('geeft de sessies met deze oefening, nieuwste eerst', () => {
    const sessions = [
      session('2026-08-01', 'Lower A', [
        { weightKg: 80, reps: 8 },
        { weightKg: 80, reps: 7 },
      ]),
      session('2026-08-05', 'Upper A', [{ name: 'Bench press', weightKg: 60, reps: 8 }]),
      session('2026-08-08', 'Lower A', [{ weightKg: 85, reps: 6 }]),
    ];

    const history = exerciseSessions(sessions, 'Squat');
    expect(history.map((h) => h.day)).toEqual(['2026-08-08', '2026-08-01']);
    expect(history[0].topWeightKg).toBe(85);
    expect(history[1].sets).toHaveLength(2);
  });

  it('laat sets in setvolgorde staan', () => {
    const sessions = [
      session('2026-08-01', 'Lower A', [
        { weightKg: 80, reps: 6, setIndex: 2 },
        { weightKg: 80, reps: 8, setIndex: 0 },
        { weightKg: 80, reps: 7, setIndex: 1 },
      ]),
    ];

    expect(exerciseSessions(sessions, 'Squat')[0].sets.map((s) => s.reps)).toEqual([8, 7, 6]);
  });
});
