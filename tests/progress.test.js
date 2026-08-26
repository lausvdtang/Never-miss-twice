import { describe, expect, it } from 'vitest';
import {
  changeLabel,
  progressSummary,
  sessionsForTemplate,
  topWeightSeries,
  volumeChange,
  volumeSeries,
} from '../app/progress.js';
import { exerciseLibrary } from '../app/presets.js';

function session(day, templateName, sets, status = 'voltooid') {
  return {
    id: `s_${day}`,
    day,
    templateId: 'tpl',
    templateName,
    status,
    startedAt: `${day}T08:00:00.000Z`,
    finishedAt: `${day}T09:00:00.000Z`,
    sets: sets.map((s, i) => ({
      id: `set_${day}_${i}`,
      exerciseName: s.name ?? 'Bench press',
      setIndex: i,
      weightKg: s.weightKg,
      reps: s.reps,
      done: s.done ?? true,
      seeded: s.seeded,
      loggedAt: day,
    })),
  };
}

describe('volumeSeries', () => {
  it('pakt alleen sessies van hetzelfde schema', () => {
    const sessions = [
      session('2026-08-01', 'Push A', [{ weightKg: 60, reps: 8 }]),
      session('2026-08-02', 'Legs A', [{ weightKg: 100, reps: 8 }]),
      session('2026-08-08', 'Push A', [{ weightKg: 65, reps: 8 }]),
    ];
    const series = volumeSeries(sessions, 'Push A');
    expect(series).toHaveLength(2);
    expect(series[0].value).toBe(480);
    expect(series[1].value).toBe(520);
  });

  it('zet de oudste sessie vooraan', () => {
    const sessions = [
      session('2026-08-08', 'Push A', [{ weightKg: 65, reps: 8 }]),
      session('2026-08-01', 'Push A', [{ weightKg: 60, reps: 8 }]),
    ];
    expect(volumeSeries(sessions, 'Push A').map((s) => s.day)).toEqual([
      '2026-08-01',
      '2026-08-08',
    ]);
  });

  it('telt een sessie waarin je gewicht invulde zonder af te vinken', () => {
    const sessions = [
      session('2026-08-01', 'Push A', [{ weightKg: 60, reps: 8, done: false }]),
      session('2026-08-08', 'Push A', [{ weightKg: 65, reps: 8 }]),
    ];
    const series = volumeSeries(sessions, 'Push A');
    expect(series).toHaveLength(2);
    // En het volume klopt: niet 0 omdat de vinkjes ontbreken.
    expect(series[0].value).toBe(480);
  });

  it('telt een sessie die nog openstaat maar waar werk in zit', () => {
    const sessions = [session('2026-08-01', 'Push A', [{ weightKg: 60, reps: 8 }], 'bezig')];
    expect(volumeSeries(sessions, 'Push A')).toHaveLength(1);
  });

  it('negeert een sessie met alleen voorstellen van de app', () => {
    const sessions = [
      session('2026-08-01', 'Push A', [{ weightKg: 60, reps: 8, done: false, seeded: true }], 'bezig'),
    ];
    expect(volumeSeries(sessions, 'Push A')).toHaveLength(0);
  });

  it('houdt de reeks kort genoeg voor het scherm', () => {
    const sessions = Array.from({ length: 20 }, (_, i) =>
      session(`2026-08-${String(i + 1).padStart(2, '0')}`, 'Push A', [
        { weightKg: 60, reps: 8 },
      ]),
    );
    expect(volumeSeries(sessions, 'Push A', { limit: 8 })).toHaveLength(8);
  });
});

describe('topWeightSeries', () => {
  it('pakt per sessie het zwaarste werkgewicht', () => {
    const sessions = [
      session('2026-08-01', 'Push A', [
        { weightKg: 60, reps: 8 },
        { weightKg: 65, reps: 6 },
      ]),
      session('2026-08-08', 'Push A', [{ weightKg: 70, reps: 6 }]),
    ];
    expect(topWeightSeries(sessions, 'Bench press').map((p) => p.weightKg)).toEqual([65, 70]);
  });

  it('slaat sessies zonder die oefening over', () => {
    const sessions = [
      session('2026-08-01', 'Push A', [{ name: 'Squat', weightKg: 100, reps: 5 }]),
      session('2026-08-08', 'Push A', [{ weightKg: 70, reps: 6 }]),
    ];
    expect(topWeightSeries(sessions, 'Bench press')).toHaveLength(1);
  });
});

describe('volumeChange en samenvatting', () => {
  const grow = [
    { day: '2026-08-01', label: '1', value: 1000 },
    { day: '2026-08-08', label: '8', value: 1100 },
  ];

  it('rekent het verschil met de vorige sessie uit', () => {
    expect(volumeChange(grow)).toBe(10);
  });

  it('geeft niets terug bij één sessie', () => {
    expect(volumeChange(grow.slice(0, 1))).toBeNull();
  });

  it('meldt een record als zodanig', () => {
    expect(progressSummary(grow)).toContain('Hoogste volume');
  });

  it('blijft neutraal bij een mindere sessie', () => {
    const dip = [...grow, { day: '2026-08-15', label: '15', value: 900 }];
    const text = progressSummary(dip);
    expect(text).toContain('minder');
    expect(text).toContain('hoort erbij');
    // Geen schuldgevoel-taal, ook niet als het even minder gaat.
    for (const woord of ['gefaald', 'slecht', 'fout']) {
      expect(text.toLowerCase()).not.toContain(woord);
    }
  });

  it('zegt netjes wanneer er nog niets te vergelijken valt', () => {
    expect(progressSummary([])).toContain('Nog geen');
  });

  it('meldt geen "100% minder" bij een sessie zonder extra gewicht', () => {
    // Alleen lichaamsgewicht: volume is 0, maar dat is geen terugval.
    const bodyweight = [...grow, { day: '2026-08-15', label: '15', value: 0 }];
    const text = progressSummary(bodyweight);
    expect(text).not.toContain('100%');
    expect(text).toContain('lichaamsgewicht');
  });
});

describe('sessionsForTemplate', () => {
  it('telt de minimale versie mee als er sets in staan', () => {
    const sessions = [
      session('2026-08-01', 'Push A', [{ weightKg: 60, reps: 8 }], 'minimaal'),
    ];
    expect(sessionsForTemplate(sessions, 'Push A')).toHaveLength(1);
  });
});

describe('exerciseLibrary', () => {
  const library = exerciseLibrary();

  it('bevat de schema-oefeningen zonder dubbelingen', () => {
    const names = library.map((e) => e.name);
    expect(names).toContain('Bench press');
    expect(names).toContain('Squat');
    expect(new Set(names).size).toBe(names.length);
  });

  it('biedt alternatieven buiten de standaardschema', () => {
    expect(library.map((e) => e.name)).toContain('Machine chest press');
  });

  it('geeft elke oefening sets en een repbereik', () => {
    for (const e of library) {
      expect(e.sets).toBeGreaterThan(0);
      expect(e.repRange).toBeTruthy();
    }
  });
});

describe('changeLabel', () => {
  const base = { day: '2026-08-01', label: '1' };

  it('toont de stijging ten opzichte van de vorige sessie', () => {
    const label = changeLabel([
      { ...base, value: 1000 },
      { ...base, day: '2026-08-08', value: 1080 },
    ]);
    expect(label.text).toBe('+8%');
    expect(label.tone).toBe('accent');
  });

  it('toont een daling zonder alarmkleur', () => {
    const label = changeLabel([
      { ...base, value: 1000 },
      { ...base, day: '2026-08-08', value: 900 },
    ]);
    expect(label.text).toBe('-10%');
    expect(label.tone).toBe('calm');
  });

  it('valt terug op een neutraal label bij één sessie', () => {
    expect(changeLabel([{ ...base, value: 1000 }]).text).toBe('volume');
  });
});
