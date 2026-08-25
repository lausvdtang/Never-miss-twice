import { describe, expect, it } from 'vitest';
import { createScheduler } from '../app/dom.js';

/*
 * Achtergrond: de getalvelden leggen hun waarde vast zodra ze hun focus
 * verliezen. Het leegmaken van het scherm doet precies dat, dus een
 * tekenbeurt kan middenin zichzelf een nieuwe tekenbeurt uitlokken. Zonder
 * bescherming bouwt de binnenste beurt het scherm op en gooit de buitenste
 * het daarna alsnog weg.
 */
describe('createScheduler', () => {
  it('draait een gewone aanroep meteen', () => {
    let runs = 0;
    createScheduler(() => runs++)();
    expect(runs).toBe(1);
  });

  it('stelt een aanroep van binnenuit uit tot na de lopende beurt', () => {
    const order = [];
    let first = true;
    let run;

    run = createScheduler(() => {
      order.push('start');
      if (first) {
        first = false;
        run(); // hertekening uitgelokt door een blur tijdens het leegmaken
        order.push('binnenste-teruggekeerd');
      }
      order.push('einde');
    });

    run();

    // De tweede beurt begint pas nadat de eerste helemaal klaar is.
    expect(order).toEqual([
      'start',
      'binnenste-teruggekeerd',
      'einde',
      'start',
      'einde',
    ]);
  });

  it('voegt meerdere aanroepen van binnenuit samen tot één extra beurt', () => {
    let runs = 0;
    let run;
    run = createScheduler(() => {
      runs++;
      if (runs === 1) {
        run();
        run();
        run();
      }
    });
    run();
    expect(runs).toBe(2);
  });

  it('blijft bruikbaar nadat de tekenfunctie een fout gooit', () => {
    let runs = 0;
    const run = createScheduler(() => {
      runs++;
      if (runs === 1) throw new Error('stuk');
    });

    expect(() => run()).toThrow('stuk');
    // De vlag moet weer vrij zijn, anders bevriest het scherm na één fout.
    run();
    expect(runs).toBe(2);
  });

  it('raakt geen enkele wijziging kwijt bij herhaald nesten', () => {
    let runs = 0;
    let pending = 3;
    let run;
    run = createScheduler(() => {
      runs++;
      if (pending > 0) {
        pending--;
        run();
      }
    });
    run();
    expect(runs).toBe(4);
  });
});
