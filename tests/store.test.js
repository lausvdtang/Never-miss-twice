import { beforeEach, describe, expect, it } from 'vitest';
import { getState, initialState, replaceState, subscribe, update } from '../app/store.js';

beforeEach(() => {
  replaceState(initialState());
});

describe('store — reactiviteit', () => {
  /*
   * De schermen worden opnieuw opgebouwd zodra de store een nieuwe root-
   * referentie oplevert. Een mutator die de bestaande state aanpast zonder
   * die nieuwe referentie levert dus wel kloppende data op, maar een scherm
   * dat niet meebeweegt.
   */
  it('geeft na elke update een nieuwe root-referentie', () => {
    const before = getState();
    update((s) => {
      s.profile = { ...s.profile, name: 'Laurens' };
    });
    const after = getState();

    expect(after).not.toBe(before);
    expect(after.profile.name).toBe('Laurens');
  });

  it('laat de vorige snapshot ongemoeid', () => {
    const before = getState();
    update((s) => {
      s.profile = { ...s.profile, name: 'Laurens' };
    });
    expect(before.profile.name).toBe('');
  });

  it('geeft ook een nieuwe referentie bij het toevoegen aan een lijst', () => {
    const before = getState();
    update((s) => {
      s.habitLogs = [
        ...s.habitLogs,
        { habitId: 'hab_training', day: '2026-08-04', completion: 'vol', loggedAt: '' },
      ];
    });
    expect(getState()).not.toBe(before);
    expect(getState().habitLogs).toHaveLength(1);
  });

  it('stelt abonnees op de hoogte', () => {
    let calls = 0;
    const unsubscribe = subscribe(() => calls++);
    update((s) => {
      s.profile = { ...s.profile, weightKg: 80 };
    });
    update((s) => {
      s.profile = { ...s.profile, weightKg: 81 };
    });
    unsubscribe();
    update((s) => {
      s.profile = { ...s.profile, weightKg: 82 };
    });
    expect(calls).toBe(2);
  });

  it('accepteert een mutator die een volledige state teruggeeft', () => {
    update((s) => ({ ...s, dismissedNudges: ['a'] }));
    expect(getState().dismissedNudges).toEqual(['a']);
  });
});

describe('store — standaardinhoud', () => {
  it('start met schema, gewoontes en supplementen uit de kennisbasis', () => {
    const s = initialState();
    expect(s.templates.length).toBeGreaterThan(0);
    expect(s.habits.length).toBeGreaterThan(0);
    expect(s.supplements.find((x) => x.key === 'creatine').everyDay).toBe(true);
    expect(s.profile.onboarded).toBe(false);
  });

  it('zet de standaard lesdagen op maandag, woensdag en vrijdag', () => {
    expect(initialState().profile.teachingDays).toEqual([1, 3, 5]);
  });
});
