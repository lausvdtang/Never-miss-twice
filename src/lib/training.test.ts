import { describe, expect, it } from 'vitest';
import { buildTemplates, defaultDayAssignment, splitForDays } from '../data/presets';
import { lastSetsFor, suggestNext, WEIGHT_STEP } from './training';
import type { SetLog, TemplateExercise, WorkoutSession } from './types';

const bench: TemplateExercise = {
  id: 'e1',
  name: 'Bench press',
  sets: 3,
  repRange: '6-8',
  repLow: 6,
  repHigh: 8,
};

function session(day: string, sets: Partial<SetLog>[]): WorkoutSession {
  return {
    id: `s_${day}`,
    day,
    templateId: 'tpl',
    templateName: 'Push A',
    status: 'voltooid',
    startedAt: `${day}T08:00:00.000Z`,
    finishedAt: `${day}T09:00:00.000Z`,
    sets: sets.map((s, i) => ({
      id: `set_${day}_${i}`,
      exerciseName: 'Bench press',
      setIndex: i,
      weightKg: 60,
      reps: 8,
      done: true,
      loggedAt: day,
      ...s,
    })),
  };
}

describe('progressive overload', () => {
  it('start zonder voorstel als er nog geen historie is', () => {
    const s = suggestNext(bench, []);
    expect(s.previous).toBeNull();
    expect(s.reps).toBe(bench.repLow);
    expect(s.isIncrease).toBe(false);
  });

  it('verhoogt het gewicht als het hele repbereik gehaald is', () => {
    const previous = session('2026-08-01', [{}, {}, {}]).sets; // 3× 60 kg × 8
    const s = suggestNext(bench, previous);
    expect(s.isIncrease).toBe(true);
    expect(s.weightKg).toBe(60 + WEIGHT_STEP);
    expect(s.reps).toBe(bench.repLow);
  });

  it('houdt het gewicht vast als het bovenste rep-doel niet gehaald is', () => {
    const previous = session('2026-08-01', [{ reps: 8 }, { reps: 7 }, { reps: 6 }]).sets;
    const s = suggestNext(bench, previous);
    expect(s.isIncrease).toBe(false);
    expect(s.weightKg).toBe(60);
    expect(s.reps).toBe(8); // één meer dan de beste set, geplafonneerd op repHigh
  });

  it('verhoogt niet als er te weinig sets op het topgewicht staan', () => {
    const previous = session('2026-08-01', [{ reps: 8 }]).sets;
    const s = suggestNext(bench, previous);
    expect(s.isIncrease).toBe(false);
  });

  it('toont wat je vorige keer deed', () => {
    const previous = session('2026-08-01', [{ reps: 7 }]).sets;
    expect(suggestNext(bench, previous).previous).toBe('Vorige keer 60 kg × 7');
  });
});

describe('lastSetsFor', () => {
  it('pakt de meest recente sessie met die oefening', () => {
    const sessions = [
      session('2026-07-20', [{ weightKg: 50 }]),
      session('2026-08-01', [{ weightKg: 60 }]),
    ];
    expect(lastSetsFor('Bench press', sessions)[0].weightKg).toBe(60);
  });

  it('slaat de huidige sessie over', () => {
    const older = session('2026-07-20', [{ weightKg: 50 }]);
    const current = session('2026-08-01', [{ weightKg: 60 }]);
    const sets = lastSetsFor('Bench press', [older, current], current.id);
    expect(sets[0].weightKg).toBe(50);
  });

  it('negeert niet-afgevinkte sets en geplande sessies', () => {
    const planned: WorkoutSession = { ...session('2026-08-02', [{}]), status: 'gepland' };
    const unchecked = session('2026-08-01', [{ done: false }]);
    expect(lastSetsFor('Bench press', [planned, unchecked])).toEqual([]);
  });
});

describe('schemakeuze', () => {
  it('kiest een schema per aantal beschikbare dagen', () => {
    expect(splitForDays(6)).toBe('ppl6');
    expect(splitForDays(5)).toBe('upperlower5');
    expect(splitForDays(4)).toBe('upperlower4');
    expect(splitForDays(3)).toBe('fullbody3');
    expect(splitForDays(2)).toBe('fullbody3');
  });

  it('geeft per schema evenveel dagen als sessies', () => {
    const templates = buildTemplates();
    for (const days of [3, 4, 5, 6]) {
      const split = splitForDays(days);
      const count = templates.filter((t) => t.split === split).length;
      expect(defaultDayAssignment(days).length).toBe(count);
    }
  });

  it('houdt zondag vrij in het 6-daagse schema', () => {
    expect(defaultDayAssignment(6)).not.toContain(7);
  });

  it('zet full body op maandag, woensdag en vrijdag', () => {
    expect(defaultDayAssignment(3)).toEqual([1, 3, 5]);
  });
});

describe('schema-inhoud uit de kennisbasis', () => {
  const templates = buildTemplates();

  it('bevat het volledige 6-daagse Push/Pull/Legs-schema', () => {
    const ppl = templates.filter((t) => t.split === 'ppl6');
    expect(ppl.map((t) => t.name)).toEqual([
      'Push A',
      'Pull A',
      'Legs A',
      'Push B',
      'Pull B',
      'Legs B',
    ]);
  });

  it('houdt elke sessie op 5-6 oefeningen', () => {
    for (const t of templates) {
      expect(t.exercises.length).toBeGreaterThanOrEqual(5);
      expect(t.exercises.length).toBeLessThanOrEqual(6);
    }
  });

  it('geeft elke sessie een minimale versie en een kernoefening', () => {
    for (const t of templates) {
      expect(t.minimalVersion).toBeTruthy();
      expect(t.exercises.some((e) => e.isKeystone)).toBe(true);
    }
  });

  it('parseert repbereiken correct', () => {
    const push = templates.find((t) => t.name === 'Push A')!;
    const benchEx = push.exercises[0];
    expect(benchEx.name).toBe('Bench press');
    expect([benchEx.repLow, benchEx.repHigh]).toEqual([6, 8]);

    const single = push.exercises.find((e) => e.repRange === '12')!;
    expect([single.repLow, single.repHigh]).toEqual([12, 12]);
  });

  it('traint elke spiergroep minstens 2× per week in elk schema', () => {
    // Grove indeling op oefeningnaam — genoeg om de harde regel te bewaken.
    const groups: Record<string, RegExp> = {
      borst: /bench|press|dips|fly/i,
      rug: /row|pulldown|pull-up|deadlift|rack pull/i,
      benen: /squat|deadlift|leg|calf|romanian/i,
      schouders: /overhead|shoulder|lateral|face pull|rear delt/i,
    };

    for (const split of ['ppl6', 'upperlower5', 'upperlower4', 'fullbody3'] as const) {
      const sessions = buildTemplates().filter((t) => t.split === split);
      for (const [group, pattern] of Object.entries(groups)) {
        const hits = sessions.filter((s) =>
          s.exercises.some((e) => pattern.test(e.name)),
        ).length;
        expect(hits, `${split} → ${group}`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
