import { useMemo, useState } from 'react';
import { Badge, Card, Check, Ring, Sheet, tapFeedback, useToast } from '../components/ui';
import { ALCOHOL_PRESETS, MINIMAL_VERSION_TEXT } from '../data/presets';
import { formatDay, greeting, isoWeekday, today } from '../lib/date';
import { collectNudges, completionMessage } from '../lib/habits';
import { useNav } from '../lib/nav';
import { macroTargets } from '../lib/nutrition';
import {
  dailyTotals,
  habitStates,
  needsCheckIn,
  planForDay,
  stepsOn,
  supplementsOn,
} from '../lib/selectors';
import { newId, nowISO, useAppState, useUpdate } from '../lib/store';
import { hoursSinceLastSession } from '../lib/training';
import type { SupplementKey } from '../lib/types';
import { AlcoholSheet } from './sheets/AlcoholSheet';
import { QuickFoodSheet } from './sheets/QuickFoodSheet';
import { startSession } from './Training';

export function Today() {
  const state = useAppState();
  const update = useUpdate();
  const nav = useNav();
  const toast = useToast();
  const day = today();

  const [foodOpen, setFoodOpen] = useState(false);
  const [alcoholOpen, setAlcoholOpen] = useState(false);
  const [badDayOpen, setBadDayOpen] = useState(false);

  const plan = useMemo(() => planForDay(state, day), [state, day]);
  const targets = useMemo(() => macroTargets(state.profile), [state.profile]);
  const totals = useMemo(() => dailyTotals(state, day), [state, day]);
  const habits = useMemo(() => habitStates(state, day), [state, day]);
  const nudges = useMemo(
    () => collectNudges(habits, state.dismissedNudges, day),
    [habits, state.dismissedNudges, day],
  );
  const supplementsTaken = supplementsOn(state, day);
  const steps = stepsOn(state, day);

  const sessionDone =
    plan.session?.status === 'voltooid' || plan.session?.status === 'minimaal';
  const restDay = !plan.template;

  /* ------------------------------------------------------- acties */

  function toggleHabit(habitId: string, minimal = false) {
    const habit = state.habits.find((h) => h.id === habitId);
    if (!habit) return;
    const existing = state.habitLogs.find(
      (l) => l.habitId === habitId && l.day === day,
    );
    update((s) => {
      s.habitLogs = existing
        ? s.habitLogs.filter((l) => !(l.habitId === habitId && l.day === day))
        : [
            ...s.habitLogs,
            {
              habitId,
              day,
              completion: minimal ? 'minimaal' : 'vol',
              loggedAt: nowISO(),
            },
          ];
    });
    if (!existing) {
      tapFeedback(state.settings.celebrate);
      toast(completionMessage(habit, minimal), true);
    }
  }

  function toggleSupplement(key: SupplementKey) {
    const log = state.supplementLogs.find((l) => l.day === day);
    const taken = log?.taken ?? [];
    const next = taken.includes(key)
      ? taken.filter((k) => k !== key)
      : [...taken, key];
    update((s) => {
      s.supplementLogs = log
        ? s.supplementLogs.map((l) => (l.day === day ? { ...l, taken: next } : l))
        : [...s.supplementLogs, { day, taken: next }];
    });
    if (!taken.includes(key)) tapFeedback(state.settings.celebrate);
  }

  function dismissNudge(key: string) {
    update((s) => {
      s.dismissedNudges = [...s.dismissedNudges, key];
    });
  }

  /** "Even geen dag": de sessie wordt de minimale versie, nooit een misser. */
  function logBadDay() {
    const existing = plan.session;
    update((s) => {
      if (existing) {
        s.sessions = s.sessions.map((x) =>
          x.id === existing.id
            ? {
                ...x,
                status: 'minimaal',
                finishedAt: nowISO(),
                minimalNote: MINIMAL_VERSION_TEXT,
              }
            : x,
        );
      } else {
        s.sessions = [
          ...s.sessions,
          {
            id: newId('ses'),
            day,
            templateId: plan.template?.id ?? null,
            templateName: plan.template?.name ?? 'Minimale versie',
            status: 'minimaal',
            startedAt: nowISO(),
            finishedAt: nowISO(),
            sets: [],
            minimalNote: MINIMAL_VERSION_TEXT,
          },
        ];
      }
    });
    setBadDayOpen(false);
    tapFeedback(state.settings.celebrate);
    toast('Ik ben iemand die traint. Ook vandaag — dit telt volledig mee.', true);
  }

  function openSession() {
    const id = startSession(state, update, day);
    nav.go('sessie', id);
  }

  /* -------------------------------------------------------- render */

  const proteinPct = targets.proteinG > 0 ? totals.proteinG / targets.proteinG : 0;
  const kcalLeft = targets.kcal - totals.kcal;

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">{formatDay(day)}</p>
          <h1>
            {greeting()}
            {state.profile.name ? `, ${state.profile.name}` : ''}
          </h1>
        </div>
        <button
          className="btn icon ghost"
          onClick={() => nav.go('instellingen')}
          aria-label="Instellingen"
        >
          ⚙︎
        </button>
      </header>

      {/*
        Never miss twice — staat bovenaan omdat dit de kern van de app is.
        Bewust maar één kaart tegelijk: vijf "je hebt twee dagen overgeslagen"-
        kaarten op een rij is precies de overweldiging waar deze app tegen
        bedoeld is, en het duwt de primaire actie onder de vouw. De volgende
        verschijnt vanzelf zodra deze is afgehandeld.
      */}
      {nudges.length > 0 && (
        <Card tone={nudges[0].tone === 'herstel' ? 'attention' : 'calm'}>
          <div className="card-title">
            <h3>{nudges[0].title}</h3>
            <button
              className="btn quiet sm"
              onClick={() => dismissNudge(nudges[0].key)}
              aria-label="Sluiten"
            >
              ✕
            </button>
          </div>
          <p className="muted">{nudges[0].body}</p>
          <button
            className="btn primary block"
            onClick={() => {
              toggleHabit(nudges[0].habitId, nudges[0].tone === 'herstel');
              dismissNudge(nudges[0].key);
            }}
          >
            {nudges[0].actionLabel}
          </button>
          {nudges.length > 1 && (
            <p className="faint">
              Er wachten nog {nudges.length - 1} andere. Eén tegelijk is genoeg — de
              volgende verschijnt hierna.
            </p>
          )}
        </Card>
      )}

      {needsCheckIn(state) && (
        <Card tone="calm">
          <div className="row-between">
            <div className="grow">
              <h3>Weekcheck-in</h3>
              <p className="muted">Drie vragen. Bepaalt je schema voor deze week.</p>
            </div>
            <button className="btn primary" onClick={() => nav.go('week')}>
              Start
            </button>
          </div>
        </Card>
      )}

      {/* Eén primaire actie per scherm: de training van vandaag. */}
      <Card>
        <div className="card-title">
          <p className="eyebrow">Vandaag trainen</p>
          {plan.isTeachingDay && <Badge tone="calm">Lesdag · {plan.preferredTime}</Badge>}
        </div>

        {sessionDone ? (
          <>
            <h2>
              {plan.session?.status === 'minimaal'
                ? 'Minimale versie gedaan'
                : `${plan.session?.templateName} — klaar`}
            </h2>
            <p className="muted">Ik ben iemand die traint. Vandaag klopt dat weer.</p>
            {plan.session && plan.session.sets.length > 0 && (
              <button
                className="btn ghost block"
                onClick={() => nav.go('sessie', plan.session!.id)}
              >
                Sessie bekijken
              </button>
            )}
          </>
        ) : restDay ? (
          <>
            <h2>Rustdag</h2>
            <p className="muted">
              Herstel is onderdeel van het schema. Wil je toch bewegen: een wandeling of
              20-30 min zone-2 past prima vandaag.
            </p>
            <button className="btn ghost block" onClick={() => nav.go('training')}>
              Toch trainen of cardio loggen
            </button>
          </>
        ) : (
          <>
            <h2>{plan.template?.name}</h2>
            <p className="muted">
              {plan.template?.exercises.length} oefeningen · 45-60 min
              {plan.preferredTime !== 'flexibel' ? ` · ${plan.preferredTime}` : ''}
            </p>
            <button className="btn primary xl block" onClick={openSession}>
              Start {plan.template?.name}
              <span className="btn-sub">
                Eerste oefening: {plan.template?.exercises[0]?.name}
              </span>
            </button>
            <button className="btn quiet block" onClick={() => setBadDayOpen(true)}>
              Even geen dag vandaag
            </button>
          </>
        )}
      </Card>

      {/* Voeding compact: ring voor kcal, balk voor eiwit. Twee taps om te loggen. */}
      <Card>
        <div className="card-title">
          <p className="eyebrow">Voeding</p>
          <button className="btn quiet sm" onClick={() => nav.go('voeding')}>
            Alles →
          </button>
        </div>
        <div className="ring-wrap">
          <Ring
            value={totals.kcal}
            max={targets.kcal}
            label={String(Math.max(0, Math.round(kcalLeft)))}
            unit={kcalLeft >= 0 ? 'kcal over' : 'kcal boven'}
          />
          <div className="grow stack-sm">
            <div className="row-between">
              <span className="muted">Eiwit</span>
              <span className="muted">
                {Math.round(totals.proteinG)} / {targets.proteinG} g
              </span>
            </div>
            <div className="bar">
              <div
                className="bar-fill"
                style={{
                  width: `${Math.min(100, proteinPct * 100)}%`,
                  background: 'var(--accent)',
                }}
              />
            </div>
            {totals.alcoholKcal > 0 && (
              <p className="faint">
                Waarvan {Math.round(totals.alcoholKcal)} kcal uit{' '}
                {totals.alcoholGlasses.toFixed(1).replace('.', ',')} standaardglazen.
              </p>
            )}
          </div>
        </div>
        <div className="grid-2">
          <button className="btn lg" onClick={() => setFoodOpen(true)}>
            + Eten
          </button>
          <button className="btn lg free" onClick={() => setAlcoholOpen(true)}>
            + Biertje
          </button>
        </div>
      </Card>

      {/* Dagelijkse afvinklijst: alles in één tap per item. */}
      <Card>
        <div className="card-title">
          <p className="eyebrow">Vandaag afvinken</p>
          <button className="btn quiet sm" onClick={() => nav.go('gewoontes')}>
            Alles →
          </button>
        </div>

        <div className="list">
          {habits
            .filter((h) => h.activeToday)
            .map((h) => (
              <button
                key={h.habit.id}
                className="list-item"
                onClick={() => toggleHabit(h.habit.id)}
                disabled={!!h.habit.autoSource && h.doneToday}
              >
                <Check on={h.doneToday} />
                <span className="grow">
                  <span style={{ display: 'block', fontWeight: 600 }}>
                    {h.habit.icon} {h.habit.name}
                  </span>
                  <span className="faint">
                    {h.doneToday
                      ? h.habit.identity
                      : h.habit.anchor || h.habit.minimalVersion}
                  </span>
                </span>
                {h.streak > 0 && <Badge tone="accent">{h.streak}</Badge>}
              </button>
            ))}
        </div>
      </Card>

      {/* Supplementen: creatine bovenaan, want hoogste prioriteit. */}
      <Card>
        <p className="eyebrow">Supplementen</p>
        <div className="row wrap">
          {state.supplements
            .filter((s) => s.enabled)
            .sort((a, b) => a.priority - b.priority)
            .map((s) => {
              const on = supplementsTaken.includes(s.key);
              return (
                <button
                  key={s.key}
                  className={`chip${on ? ' on' : ''}`}
                  onClick={() => toggleSupplement(s.key)}
                >
                  {on ? '✓ ' : ''}
                  {s.name}
                  {s.key === 'creatine' && !on ? ` · ${s.dose}` : ''}
                </button>
              );
            })}
        </div>
        {!supplementsTaken.includes('creatine') && (
          <p className="faint">
            Creatine ook op rustdagen — dat is het enige supplement dat elke dag telt.
          </p>
        )}
      </Card>

      {/* Stappen: één tap per bijstelling van 1.000. */}
      <Card>
        <div className="row-between">
          <div className="grow">
            <p className="eyebrow">Stappen</p>
            <h3>
              {steps.toLocaleString('nl-NL')}{' '}
              <span className="muted" style={{ fontWeight: 400 }}>
                / {state.profile.stepGoal.toLocaleString('nl-NL')}
              </span>
            </h3>
          </div>
          <div className="row">
            <button
              className="btn ghost icon"
              aria-label="Duizend stappen minder"
              onClick={() =>
                update((s) => {
                  const existing = s.steps.find((x) => x.day === day);
                  const next = Math.max(0, (existing?.steps ?? 0) - 1000);
                  s.steps = existing
                    ? s.steps.map((x) => (x.day === day ? { ...x, steps: next } : x))
                    : [...s.steps, { day, steps: next }];
                })
              }
            >
              −
            </button>
            <button
              className="btn ghost icon"
              aria-label="Duizend stappen erbij"
              onClick={() => {
                update((s) => {
                  const existing = s.steps.find((x) => x.day === day);
                  const next = (existing?.steps ?? 0) + 1000;
                  s.steps = existing
                    ? s.steps.map((x) => (x.day === day ? { ...x, steps: next } : x))
                    : [...s.steps, { day, steps: next }];
                });
                tapFeedback(state.settings.celebrate);
              }}
            >
              +
            </button>
          </div>
        </div>
        <div className="bar">
          <div
            className="bar-fill"
            style={{
              width: `${Math.min(100, (steps / state.profile.stepGoal) * 100)}%`,
              background: 'var(--calm)',
            }}
          />
        </div>
      </Card>

      <Sheet
        open={badDayOpen}
        onClose={() => setBadDayOpen(false)}
        title="Even geen dag"
      >
        <p className="muted">
          Prima. We zetten de sessie om naar de kleinste versie — dat telt volledig mee
          en je streak loopt gewoon door.
        </p>
        <Card tone="flat">
          <h3>{MINIMAL_VERSION_TEXT}</h3>
          <p className="faint">
            {plan.template
              ? `Bijvoorbeeld: ${plan.template.exercises.find((e) => e.isKeystone)?.name ?? plan.template.exercises[0]?.name}, één set.`
              : 'Kies één oefening die je in vijf minuten doet.'}
          </p>
        </Card>
        <button className="btn primary lg block" onClick={logBadDay}>
          Zo doen we het
        </button>
        <button className="btn quiet block" onClick={() => setBadDayOpen(false)}>
          Terug
        </button>
      </Sheet>

      <QuickFoodSheet open={foodOpen} onClose={() => setFoodOpen(false)} day={day} />
      <AlcoholSheet
        open={alcoholOpen}
        onClose={() => setAlcoholOpen(false)}
        day={day}
        presets={ALCOHOL_PRESETS}
        hoursSinceTraining={hoursSinceLastSession(state.sessions)}
        showRecoveryHint={state.settings.alcoholRecoveryHint}
      />
    </div>
  );
}

/** Hulpje voor schermen die willen weten of vandaag een lesdag is. */
export function isTeachingDay(teachingDays: number[], day = today()): boolean {
  return teachingDays.includes(isoWeekday(day));
}
