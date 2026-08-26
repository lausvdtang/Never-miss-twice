import { describe, expect, it } from 'vitest';
import { loggedSets, sessionCounts } from '../app/training.js';
import { finalizeStaleSessions } from '../app/store.js';

function session(over = {}) {
  return {
    id: 's1',
    day: '2026-08-25',
    templateName: 'Lower A',
    status: 'bezig',
    startedAt: '2026-08-25T10:00:00.000Z',
    finishedAt: null,
    sets: [],
    ...over,
  };
}

const set = (over = {}) => ({
  id: 'x',
  exerciseName: 'Squat',
  setIndex: 0,
  weightKg: 0,
  reps: 8,
  done: false,
  loggedAt: '2026-08-25T10:30:00.000Z',
  ...over,
});

/*
 * Niet iedereen tikt na de laatste set nog op "Sessie afronden" — je pakt je
 * tas en loopt de sportschool uit. Telde alleen 'voltooid' mee, dan bestond
 * een training die je wél gedaan had nergens: niet in het weekoverzicht, niet
 * in je gewoonte, niet in de grafieken.
 */
describe('sessionCounts', () => {
  it('telt een afgeronde sessie', () => {
    expect(sessionCounts(session({ status: 'voltooid' }))).toBe(true);
  });

  it('telt de minimale versie', () => {
    expect(sessionCounts(session({ status: 'minimaal' }))).toBe(true);
  });

  it('telt een sessie die nog openstaat maar waar werk in zit', () => {
    const bezig = session({ sets: [set({ weightKg: 80 })] });
    expect(sessionCounts(bezig)).toBe(true);
  });

  it('telt een openstaande sessie met alleen afgevinkte sets', () => {
    expect(sessionCounts(session({ sets: [set({ done: true })] }))).toBe(true);
  });

  it('telt een sessie die je opende en meteen verliet niet', () => {
    // Alleen voorstellen van de app, niets aangeraakt.
    const leeg = session({ sets: [set({ weightKg: 80, seeded: true })] });
    expect(sessionCounts(leeg)).toBe(false);
  });

  it('telt een gemiste sessie nooit', () => {
    expect(sessionCounts(session({ status: 'gemist', sets: [set({ weightKg: 80 })] }))).toBe(false);
  });

  it('gaat om met een dag zonder sessie', () => {
    expect(sessionCounts(null)).toBe(false);
  });
});

describe('loggedSets', () => {
  it('houdt alleen over wat je echt gedaan hebt', () => {
    const s = session({
      sets: [
        set({ id: 'a', weightKg: 80 }),
        set({ id: 'b', weightKg: 80, seeded: true }),
        set({ id: 'c', weightKg: 0, done: true }),
      ],
    });
    expect(loggedSets(s).map((x) => x.id)).toEqual(['a', 'c']);
  });
});

describe('finalizeStaleSessions', () => {
  it('rondt een sessie van gisteren alsnog af', () => {
    const state = { sessions: [session({ sets: [set({ weightKg: 80 })] })] };
    const next = finalizeStaleSessions(state, '2026-08-26');
    expect(next.sessions[0].status).toBe('voltooid');
    expect(next.sessions[0].finishedAt).toBe('2026-08-25T10:30:00.000Z');
  });

  it('laat de sessie van vandaag met rust — je bent misschien nog bezig', () => {
    const state = { sessions: [session({ sets: [set({ weightKg: 80 })] })] };
    expect(finalizeStaleSessions(state, '2026-08-25').sessions[0].status).toBe('bezig');
  });

  it('rondt een lege sessie niet af', () => {
    const state = { sessions: [session({ sets: [set({ weightKg: 80, seeded: true })] })] };
    expect(finalizeStaleSessions(state, '2026-08-26').sessions[0].status).toBe('bezig');
  });

  it('geeft dezelfde state terug als er niets te doen is', () => {
    const state = { sessions: [session({ status: 'voltooid' })] };
    expect(finalizeStaleSessions(state, '2026-08-26')).toBe(state);
  });
});
