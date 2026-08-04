import { useState } from 'react';
import { Card, Sheet, Stepper, tapFeedback, useToast } from '../../components/ui';
import { ALCOHOL_RECOVERY_WINDOW_HOURS } from '../../data/presets';
import { newId, nowISO, useAppState, useUpdate } from '../../lib/store';
import type { AlcoholPreset, DayKey } from '../../lib/types';

/**
 * Alcohol loggen zonder oordeel. De presets komen uit de kennisbasis (§8.4),
 * zodat er nooit handmatig kcal ingetypt hoeft te worden.
 */
export function AlcoholSheet({
  open,
  onClose,
  day,
  presets,
  hoursSinceTraining,
  showRecoveryHint,
}: {
  open: boolean;
  onClose: () => void;
  day: DayKey;
  presets: AlcoholPreset[];
  hoursSinceTraining: number | null;
  showRecoveryHint: boolean;
}) {
  const state = useAppState();
  const update = useUpdate();
  const toast = useToast();
  const [count, setCount] = useState(1);
  const [chosen, setChosen] = useState<AlcoholPreset | null>(null);

  const recentTraining =
    hoursSinceTraining !== null && hoursSinceTraining < ALCOHOL_RECOVERY_WINDOW_HOURS;

  function log(preset: AlcoholPreset, howMany: number) {
    update((s) => {
      s.alcohol = [
        ...s.alcohol,
        {
          id: newId('alc'),
          day,
          name: preset.name,
          kcal: preset.kcal,
          standardGlasses: preset.standardGlasses,
          count: howMany,
          presetId: preset.id,
          loggedAt: nowISO(),
          withinHoursOfTraining: hoursSinceTraining
            ? Math.round(hoursSinceTraining * 10) / 10
            : null,
        },
      ];
    });
    tapFeedback(state.settings.celebrate);
    toast('Genoteerd — verrekend in je dagbudget.');
    setChosen(null);
    setCount(1);
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        setChosen(null);
        setCount(1);
        onClose();
      }}
      title="Wat drink je?"
    >
      {/* Zachte hint, nooit een verbod (§8.4). */}
      {showRecoveryHint && recentTraining && (
        <Card tone="calm">
          <p className="muted">
            Je trainde {Math.round(hoursSinceTraining!)} uur geleden. Herstel en
            eiwitsynthese profiteren van een paar uur ertussen — verder geen probleem.
          </p>
        </Card>
      )}

      {chosen ? (
        <>
          <Card tone="flat">
            <div className="row-between">
              <div>
                <h3>{chosen.name}</h3>
                <p className="faint">
                  {chosen.volumeMl} ml · {chosen.kcal} kcal ·{' '}
                  {chosen.standardGlasses.toFixed(1).replace('.', ',')} standaardglas
                  {chosen.standardGlasses === 1 ? '' : 'sen'}
                </p>
              </div>
            </div>
            <div className="row-between">
              <span className="muted">Aantal</span>
              <Stepper value={count} onChange={setCount} min={1} max={20} label="Aantal" />
            </div>
            <div className="divider" />
            <p className="faint">
              Totaal {chosen.kcal * count} kcal — gaat automatisch van je dagbudget af.
            </p>
          </Card>
          <button className="btn primary lg block" onClick={() => log(chosen, count)}>
            Loggen
          </button>
          <button className="btn quiet block" onClick={() => setChosen(null)}>
            Iets anders
          </button>
        </>
      ) : (
        <>
          <div className="stack-sm">
            {presets.map((p) => (
              <button
                key={p.id}
                className="btn lg block"
                style={{ justifyContent: 'space-between', padding: '0 16px' }}
                onClick={() => {
                  // Eén tap = één glas. Meer? Dan pas het portie-scherm.
                  log(p, 1);
                }}
              >
                <span>{p.name}</span>
                <span className="faint">{p.kcal} kcal</span>
              </button>
            ))}
          </div>
          <button
            className="btn ghost block"
            onClick={() => setChosen(presets[0])}
          >
            Meerdere tegelijk loggen
          </button>
          <p className="faint center">
            Dit is een budget, geen oordeel. Alcohol telt mee in je 20%.
          </p>
        </>
      )}
    </Sheet>
  );
}
