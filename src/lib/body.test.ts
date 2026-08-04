import { describe, expect, it } from 'vitest';
import { bodyFatNote, trend, trendInsight, weighInGate } from './body';
import type { WeighIn } from './types';

function weighIn(day: string, weightKg: number, bodyFatPct?: number): WeighIn {
  return { id: `w_${day}`, day, weightKg, bodyFatPct, loggedAt: `${day}T07:00:00.000Z` };
}

// 2026-08-04 is een dinsdag; 2026-08-08 is de zaterdag erna.
const DINSDAG = '2026-08-04';
const ZATERDAG = '2026-08-08';

describe('weighInGate — maximaal 1× per week', () => {
  it('staat de eerste meting toe', () => {
    const gate = weighInGate([], 6, ZATERDAG);
    expect(gate.allowed).toBe(true);
    expect(gate.isWeighDay).toBe(true);
  });

  it('blokkeert een tweede meting in dezelfde week', () => {
    const gate = weighInGate([weighIn('2026-08-03', 82)], 6, ZATERDAG);
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toContain('ruis');
  });

  it('staat meten toe in een nieuwe week', () => {
    // 2026-08-01 valt in de week ervoor (die begint maandag 27 juli).
    const gate = weighInGate([weighIn('2026-08-01', 82)], 6, ZATERDAG);
    expect(gate.allowed).toBe(true);
  });

  it('waarschuwt zacht buiten de vaste weegdag zonder te blokkeren', () => {
    const gate = weighInGate([], 6, DINSDAG);
    expect(gate.allowed).toBe(true);
    expect(gate.isWeighDay).toBe(false);
    expect(gate.reason).toContain('vaste weegmoment');
  });

  it('rekent de dagen tot het volgende weegmoment uit', () => {
    expect(weighInGate([], 6, DINSDAG).daysUntilNext).toBe(4);
    expect(weighInGate([weighIn(ZATERDAG, 82)], 6, ZATERDAG).daysUntilNext).toBe(7);
  });
});

describe('trend — voortschrijdend gemiddelde', () => {
  it('middelt over de laatste metingen in plaats van losse getallen', () => {
    const points = trend([
      weighIn('2026-07-04', 84),
      weighIn('2026-07-11', 83),
      weighIn('2026-07-18', 83.5),
      weighIn('2026-07-25', 82.5),
    ]);
    expect(points[0].average).toBe(84);
    expect(points[1].average).toBe(83.5);
    // Afgerond op 0,1 kg — fijner meten dan dat is toch ruis.
    expect(points[3].average).toBe(83.3);
  });

  it('dempt een uitschieter', () => {
    const points = trend([
      weighIn('2026-07-04', 82),
      weighIn('2026-07-11', 82),
      weighIn('2026-07-18', 86), // vochtdag
    ]);
    // De losse meting springt 4 kg, het gemiddelde ruim minder.
    expect(points[2].weightKg).toBe(86);
    expect(points[2].average).toBeLessThan(84);
  });
});

describe('trendInsight — coachingdrempels', () => {
  it('waarschuwt bij meer dan 1% gewichtsverlies per week', () => {
    const insight = trendInsight(
      [
        weighIn('2026-07-04', 86),
        weighIn('2026-07-11', 84.5),
        weighIn('2026-07-18', 83),
        weighIn('2026-07-25', 81.5),
      ],
      'cut',
    )!;
    expect(insight.direction).toBe('omlaag');
    expect(insight.pctPerWeek).toBeLessThan(-1);
    expect(insight.tip).toContain('eet er wat bij');
  });

  it('stelt meer eten voor bij een stilstaande lean bulk', () => {
    const insight = trendInsight(
      [
        weighIn('2026-07-04', 82),
        weighIn('2026-07-11', 82),
        weighIn('2026-07-18', 82),
        weighIn('2026-07-25', 82),
      ],
      'leanbulk',
    )!;
    expect(insight.direction).toBe('stabiel');
    expect(insight.tip).toContain('100-150 kcal');
  });

  it('zwijgt bij een gezond tempo', () => {
    const insight = trendInsight(
      [
        weighIn('2026-07-04', 83),
        weighIn('2026-07-11', 82.7),
        weighIn('2026-07-18', 82.4),
        weighIn('2026-07-25', 82.1),
      ],
      'cut',
    )!;
    expect(insight.tip).toBeNull();
  });

  it('geeft niets terug bij minder dan twee metingen', () => {
    expect(trendInsight([weighIn('2026-07-04', 82)], 'cut')).toBeNull();
  });

  it('meet het echte tempo, zonder demping door het voortschrijdend gemiddelde', () => {
    // Precies 1,5 kg per week eraf. Een vergelijking van het eerste met het
    // laatste gemiddelde zou hier ~0,75 kg/week melden en de 1%-drempel missen.
    const insight = trendInsight(
      [
        weighIn('2026-07-04', 86),
        weighIn('2026-07-11', 84.5),
        weighIn('2026-07-18', 83),
        weighIn('2026-07-25', 81.5),
      ],
      'cut',
    )!;
    expect(insight.kgPerWeek).toBeCloseTo(-1.5, 2);
  });

  it('laat één uitschieter het tempo niet kapen', () => {
    // Stabiel gewicht met één vochtdag; de helling moet vlak blijven.
    const insight = trendInsight(
      [
        weighIn('2026-07-04', 82),
        weighIn('2026-07-11', 82),
        weighIn('2026-07-18', 85),
        weighIn('2026-07-25', 82),
      ],
      'recomp',
    )!;
    expect(Math.abs(insight.kgPerWeek)).toBeLessThan(0.5);
  });
});

describe('bodyFatNote', () => {
  it('bevestigt de doelzone', () => {
    expect(bodyFatNote(11)).toContain('zichtbaar');
  });

  it('rekent uit hoeveel er nog te gaan is', () => {
    expect(bodyFatNote(16)).toContain('4%');
  });

  it('legt uit dat het vooral uit voeding komt', () => {
    expect(bodyFatNote(18)).toContain('voeding');
  });

  it('zwijgt zonder meting', () => {
    expect(bodyFatNote(undefined)).toBeNull();
  });
});
