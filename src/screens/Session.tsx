import { useMemo, useState } from 'react';
import {
  Badge,
  Card,
  MiniStepper,
  Sheet,
  tapFeedback,
  useToast,
} from '../components/ui';
import { MINIMAL_VERSION_TEXT } from '../data/presets';
import { formatDayShort } from '../lib/date';
import { useNav } from '../lib/nav';
import { nowISO, useAppState, useUpdate } from '../lib/store';
import {
  formatWeight,
  lastSetsFor,
  sessionDurationMinutes,
  sessionVolume,
  suggestNext,
  WEIGHT_STEP,
} from '../lib/training';
import type { SetLog } from '../lib/types';

/**
 * Actieve sessie. Elke set is één tap om af te vinken; gewicht en reps staan al
 * ingevuld met het voorstel op basis van de vorige keer.
 */
export function Session({ sessionId }: { sessionId: string }) {
  const state = useAppState();
  const update = useUpdate();
  const nav = useNav();
  const toast = useToast();
  const [finishOpen, setFinishOpen] = useState(false);

  const session = state.sessions.find((s) => s.id === sessionId);
  const template = session?.templateId
    ? state.templates.find((t) => t.id === session.templateId)
    : undefined;

  const grouped = useMemo(() => {
    if (!session) return [];
    const order: string[] = [];
    const map = new Map<string, SetLog[]>();
    for (const set of session.sets) {
      if (!map.has(set.exerciseName)) {
        map.set(set.exerciseName, []);
        order.push(set.exerciseName);
      }
      map.get(set.exerciseName)!.push(set);
    }
    return order.map((name) => ({ name, sets: map.get(name)! }));
  }, [session]);

  if (!session) {
    return (
      <div className="screen">
        <p className="empty">Deze sessie bestaat niet meer.</p>
        <button className="btn ghost block" onClick={() => nav.go('training')}>
          Terug naar training
        </button>
      </div>
    );
  }

  const readOnly = session.status === 'voltooid' || session.status === 'minimaal';
  const doneSets = session.sets.filter((s) => s.done).length;
  const totalSets = session.sets.length;

  function patchSet(setId: string, patch: Partial<SetLog>) {
    update((s) => {
      s.sessions = s.sessions.map((x) =>
        x.id === sessionId
          ? { ...x, sets: x.sets.map((set) => (set.id === setId ? { ...set, ...patch } : set)) }
          : x,
      );
    });
  }

  function toggleSet(set: SetLog) {
    patchSet(set.id, { done: !set.done, loggedAt: nowISO() });
    if (!set.done) tapFeedback(state.settings.celebrate);
  }

  /** Alle sets van een oefening in één keer — scheelt taps bij een vaste opbouw. */
  function completeExercise(name: string) {
    update((s) => {
      s.sessions = s.sessions.map((x) =>
        x.id === sessionId
          ? {
              ...x,
              sets: x.sets.map((set) =>
                set.exerciseName === name ? { ...set, done: true, loggedAt: nowISO() } : set,
              ),
            }
          : x,
      );
    });
    tapFeedback(state.settings.celebrate);
    toast(`${name} afgerond`, true);
  }

  function finish(status: 'voltooid' | 'minimaal') {
    update((s) => {
      s.sessions = s.sessions.map((x) =>
        x.id === sessionId
          ? {
              ...x,
              status,
              finishedAt: nowISO(),
              ...(status === 'minimaal' ? { minimalNote: MINIMAL_VERSION_TEXT } : {}),
            }
          : x,
      );
    });
    setFinishOpen(false);
    tapFeedback(state.settings.celebrate);
    toast('Ik ben iemand die traint. Weer een dag waarop dat klopt.', true);
    nav.go('vandaag');
  }

  const duration = sessionDurationMinutes(session);

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">
            {formatDayShort(session.day)}
            {readOnly ? ' · afgerond' : ''}
          </p>
          <h1>{session.templateName}</h1>
        </div>
        <button className="btn icon ghost" onClick={() => nav.back()} aria-label="Terug">
          ✕
        </button>
      </header>

      {session.status === 'minimaal' && session.sets.length === 0 ? (
        <Card tone="accent">
          <h3>Minimale versie</h3>
          <p className="muted">{session.minimalNote ?? MINIMAL_VERSION_TEXT}</p>
          <p className="faint">
            Deze dag telt volledig mee. Eén dag klein doen is precies waar dit systeem
            voor bedoeld is.
          </p>
        </Card>
      ) : (
        <>
          {!readOnly && (
            <Card tone="flat">
              <div className="row-between">
                <span className="muted">
                  {doneSets} van {totalSets} sets
                </span>
                <Badge tone="accent">
                  {Math.round(sessionVolume(session)).toLocaleString('nl-NL')} kg
                </Badge>
              </div>
              <div className="bar">
                <div
                  className="bar-fill"
                  style={{
                    width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%`,
                    background: 'var(--accent)',
                  }}
                />
              </div>
            </Card>
          )}

          {grouped.map(({ name, sets }) => {
            const exercise = template?.exercises.find((e) => e.name === name);
            const previous = lastSetsFor(name, state.sessions, sessionId);
            const suggestion = exercise ? suggestNext(exercise, previous) : null;
            const allDone = sets.every((s) => s.done);

            return (
              <Card key={name}>
                <div className="card-title">
                  <div className="grow">
                    <h3>{name}</h3>
                    <p className="faint">
                      {exercise ? `${exercise.sets}×${exercise.repRange}` : ''}
                      {exercise?.note ? ` · ${exercise.note}` : ''}
                    </p>
                  </div>
                  {allDone && <Badge tone="accent">✓</Badge>}
                </div>

                {/* Progressive overload: vorige sessie naast het invoerveld. */}
                {suggestion && !readOnly && (
                  <div className="row-between">
                    <span className="faint">
                      {suggestion.previous ?? 'Nog geen eerdere sessie'}
                    </span>
                    {suggestion.isIncrease && <Badge tone="accent">+{WEIGHT_STEP} kg</Badge>}
                  </div>
                )}
                {suggestion && !readOnly && (
                  <p className="faint">{suggestion.reason}</p>
                )}

                <div>
                  {sets.map((set) => (
                    <div key={set.id} className={`set-row${set.done ? ' done' : ''}`}>
                      <span className="set-index">{set.setIndex + 1}</span>
                      {readOnly ? (
                        <>
                          <span className="faint">{formatWeight(set.weightKg)}</span>
                          <span className="faint">{set.reps} reps</span>
                        </>
                      ) : (
                        <>
                          <MiniStepper
                            value={set.weightKg}
                            onChange={(v) => patchSet(set.id, { weightKg: v })}
                            step={WEIGHT_STEP}
                            unit="kg"
                            ariaLabel={`${name} set ${set.setIndex + 1} gewicht`}
                          />
                          <MiniStepper
                            value={set.reps}
                            onChange={(v) => patchSet(set.id, { reps: v })}
                            min={1}
                            ariaLabel={`${name} set ${set.setIndex + 1} reps`}
                          />
                        </>
                      )}
                      <button
                        className={`check${set.done ? ' on' : ''}`}
                        onClick={() => !readOnly && toggleSet(set)}
                        aria-label={`Set ${set.setIndex + 1} afvinken`}
                        style={{ marginLeft: 'auto' }}
                        disabled={readOnly}
                      >
                        {set.done ? '✓' : ''}
                      </button>
                    </div>
                  ))}
                </div>

                {!readOnly && !allDone && (
                  <button className="btn sm ghost" onClick={() => completeExercise(name)}>
                    Alles afvinken
                  </button>
                )}
              </Card>
            );
          })}
        </>
      )}

      {readOnly ? (
        <Card tone="flat">
          <div className="row-between">
            <span className="muted">
              {duration ? `${duration} minuten` : 'Afgerond'}
            </span>
            <span className="faint">
              {session.sets.filter((s) => s.done).length} sets gelogd
            </span>
          </div>
        </Card>
      ) : (
        <>
          <button className="btn primary xl block" onClick={() => setFinishOpen(true)}>
            Sessie afronden
            <span className="btn-sub">
              {doneSets} van {totalSets} sets gedaan
            </span>
          </button>
          <button className="btn quiet block" onClick={() => finish('minimaal')}>
            Vandaag lukt het niet — noteer als minimale versie
          </button>
        </>
      )}

      <Sheet open={finishOpen} onClose={() => setFinishOpen(false)} title="Afronden">
        {doneSets < totalSets ? (
          <p className="muted">
            Je hebt {doneSets} van de {totalSets} sets gelogd. Dat is genoeg — een
            afgeronde sessie hoeft niet compleet te zijn.
          </p>
        ) : (
          <p className="muted">Alle sets gelogd. Mooi werk.</p>
        )}
        <button className="btn primary lg block" onClick={() => finish('voltooid')}>
          Afronden
        </button>
        <button className="btn quiet block" onClick={() => setFinishOpen(false)}>
          Toch nog even door
        </button>
      </Sheet>
    </div>
  );
}
