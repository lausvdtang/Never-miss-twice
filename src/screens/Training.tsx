import { useMemo, useState } from 'react';
import { Badge, Card, Sheet, Stepper, tapFeedback, useToast } from '../components/ui';
import { CARDIO_GUIDANCE, SPLIT_LABELS } from '../data/presets';
import { DAY_NAMES, formatDayShort, today } from '../lib/date';
import { useNav } from '../lib/nav';
import {
  availableDaysForWeek,
  planForDay,
  splitForWeek,
  weekCardio,
  weekSchedule,
} from '../lib/selectors';
import { newId, nowISO, useAppState, useUpdate } from '../lib/store';
import {
  cardioInterferenceWarning,
  runsThisWeek,
  seedSets,
  sessionVolume,
  weeklyCardioMinutes,
} from '../lib/training';
import type { AppState, CardioKind, DayKey } from '../lib/types';

/**
 * Start (of hervat) de sessie van een dag en geeft het sessie-id terug.
 * Sets worden meteen voorgevuld met het progressive-overload-voorstel, zodat
 * de gebruiker in de sportschool alleen nog hoeft te bevestigen.
 */
export function startSession(
  state: AppState,
  update: (m: (draft: AppState) => AppState | void) => void,
  day: DayKey,
): string {
  const existing = state.sessions.find((s) => s.day === day && s.status !== 'gemist');
  if (existing) {
    if (existing.status === 'gepland') {
      update((s) => {
        s.sessions = s.sessions.map((x) =>
          x.id === existing.id ? { ...x, status: 'bezig', startedAt: nowISO() } : x,
        );
      });
    }
    return existing.id;
  }

  const plan = planForDay(state, day);
  const id = newId('ses');
  const now = nowISO();
  update((s) => {
    s.sessions = [
      ...s.sessions,
      {
        id,
        day,
        templateId: plan.template?.id ?? null,
        templateName: plan.template?.name ?? 'Vrije sessie',
        status: 'bezig',
        startedAt: now,
        finishedAt: null,
        sets: plan.template ? seedSets(plan.template.exercises, s.sessions, now) : [],
      },
    ];
  });
  return id;
}

export function Training() {
  const state = useAppState();
  const update = useUpdate();
  const nav = useNav();
  const toast = useToast();
  const day = today();

  const [cardioOpen, setCardioOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const schedule = useMemo(() => weekSchedule(state, day), [state, day]);
  const split = splitForWeek(state);
  const plannedDays = availableDaysForWeek(state);
  const cardio = useMemo(() => weekCardio(state, day), [state, day]);
  const plan = planForDay(state, day);

  const done = schedule.filter(
    (d) => d.session?.status === 'voltooid' || d.session?.status === 'minimaal',
  ).length;

  const history = useMemo(
    () =>
      [...state.sessions]
        .filter((s) => s.status === 'voltooid' || s.status === 'minimaal')
        .sort((a, b) => b.day.localeCompare(a.day))
        .slice(0, 12),
    [state.sessions],
  );

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">Training</p>
          <h1>{SPLIT_LABELS[split]}</h1>
        </div>
        <Badge tone="accent">
          {done}/{plannedDays}
        </Badge>
      </header>

      <p className="muted">
        Elke spiergroep komt in dit schema minstens 2× per week aan bod. Dat is de enige
        harde regel — de rest past zich aan jouw week aan.
      </p>

      {/* Weekoverzicht: één regel per dag, direct te starten. */}
      <Card>
        <p className="eyebrow">Deze week</p>
        <div className="list">
          {schedule.map((d) => {
            const isToday = d.day === day;
            const finished =
              d.session?.status === 'voltooid' || d.session?.status === 'minimaal';
            return (
              <button
                key={d.day}
                className="list-item"
                onClick={() => {
                  if (finished && d.session) {
                    nav.go('sessie', d.session.id);
                  } else if (d.template && isToday) {
                    nav.go('sessie', startSession(state, update, d.day));
                  }
                }}
                disabled={!d.template && !finished}
              >
                <span
                  className="faint"
                  style={{ width: 26, fontWeight: 700, color: isToday ? 'var(--accent)' : undefined }}
                >
                  {DAY_NAMES[d.weekday - 1]}
                </span>
                <span className="grow">
                  <span style={{ display: 'block', fontWeight: 600 }}>
                    {d.template ? d.template.name : 'Rust of actief herstel'}
                  </span>
                  <span className="faint">
                    {finished
                      ? d.session?.status === 'minimaal'
                        ? 'Minimale versie — telt mee'
                        : `Voltooid · ${Math.round(sessionVolume(d.session!)).toLocaleString('nl-NL')} kg volume`
                      : d.isTeachingDay
                        ? `Lesdag · voorkeur ${d.preferredTime}`
                        : d.template
                          ? `${d.template.exercises.length} oefeningen · 45-60 min`
                          : '—'}
                  </span>
                </span>
                {finished && <Badge tone="accent">✓</Badge>}
                {isToday && !finished && d.template && <Badge>Start</Badge>}
              </button>
            );
          })}
        </div>
      </Card>

      {plan.template && !plan.session && (
        <button
          className="btn primary xl block"
          onClick={() => nav.go('sessie', startSession(state, update, day))}
        >
          Start {plan.template.name}
          <span className="btn-sub">Vandaag · 45-60 min</span>
        </button>
      )}

      {/* Cardio staat los van het krachtschema (§3A). */}
      <Card>
        <div className="card-title">
          <p className="eyebrow">Cardio</p>
          <Badge tone="calm">
            {runsThisWeek(cardio)}/{CARDIO_GUIDANCE.runsPerWeekMax} deze week
          </Badge>
        </div>
        <p className="muted">
          {CARDIO_GUIDANCE.runsPerWeekMin}-{CARDIO_GUIDANCE.runsPerWeekMax}× per week{' '}
          {CARDIO_GUIDANCE.runMinutesMin}-{CARDIO_GUIDANCE.runMinutesMax} min zone-2, op
          rustdagen of ná het krachttrainen.
        </p>
        {(() => {
          const warning = cardioInterferenceWarning(
            !!plan.template,
            plan.session?.status === 'voltooid' || plan.session?.status === 'minimaal',
          );
          return warning ? (
            <Card tone="calm">
              <p className="muted">{warning}</p>
            </Card>
          ) : null;
        })()}
        <div className="row-between">
          <span className="faint">
            {weeklyCardioMinutes(cardio)} min deze week
          </span>
          <button className="btn" onClick={() => setCardioOpen(true)}>
            + Cardio loggen
          </button>
        </div>
      </Card>

      <Card>
        <div className="card-title">
          <p className="eyebrow">Andere sessie doen</p>
        </div>
        <p className="muted">
          Schema van vandaag past niet? Kies gewoon een andere — het schema is een
          hulpmiddel, geen contract.
        </p>
        <button className="btn ghost block" onClick={() => setPickerOpen(true)}>
          Kies een sessie
        </button>
      </Card>

      {history.length > 0 && (
        <Card>
          <p className="eyebrow">Eerder</p>
          <div className="list">
            {history.map((s) => (
              <button
                key={s.id}
                className="list-item"
                onClick={() => nav.go('sessie', s.id)}
              >
                <span className="grow">
                  <span style={{ display: 'block', fontWeight: 600 }}>
                    {s.templateName}
                  </span>
                  <span className="faint">
                    {formatDayShort(s.day)} ·{' '}
                    {s.status === 'minimaal'
                      ? 'minimale versie'
                      : `${s.sets.filter((x) => x.done).length} sets`}
                  </span>
                </span>
                <span className="faint">
                  {s.status === 'minimaal'
                    ? ''
                    : `${Math.round(sessionVolume(s)).toLocaleString('nl-NL')} kg`}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <CardioSheet open={cardioOpen} onClose={() => setCardioOpen(false)} day={day} />

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Welke sessie?">
        <div className="stack-sm">
          {state.templates
            .filter((t) => t.split === split)
            .sort((a, b) => a.order - b.order)
            .map((t) => (
              <button
                key={t.id}
                className="btn lg block"
                style={{ justifyContent: 'space-between', padding: '0 16px' }}
                onClick={() => {
                  const id = newId('ses');
                  const now = nowISO();
                  update((s) => {
                    s.sessions = [
                      ...s.sessions.filter(
                        (x) => !(x.day === day && x.status === 'gepland'),
                      ),
                      {
                        id,
                        day,
                        templateId: t.id,
                        templateName: t.name,
                        status: 'bezig',
                        startedAt: now,
                        finishedAt: null,
                        sets: seedSets(t.exercises, state.sessions, now),
                      },
                    ];
                  });
                  setPickerOpen(false);
                  tapFeedback(state.settings.celebrate);
                  toast(`${t.name} gestart`);
                  nav.go('sessie', id);
                }}
              >
                <span>{t.name}</span>
                <span className="faint">{t.exercises.length} oefeningen</span>
              </button>
            ))}
        </div>
      </Sheet>
    </div>
  );
}

function CardioSheet({
  open,
  onClose,
  day,
}: {
  open: boolean;
  onClose: () => void;
  day: DayKey;
}) {
  const state = useAppState();
  const update = useUpdate();
  const toast = useToast();
  const [kind, setKind] = useState<CardioKind>('hardlopen');
  const [minutes, setMinutes] = useState(25);

  const kinds: { value: CardioKind; label: string }[] = [
    { value: 'hardlopen', label: 'Hardlopen' },
    { value: 'zone2', label: 'Zone 2' },
    { value: 'wandelen', label: 'Wandelen' },
    { value: 'fietsen', label: 'Fietsen' },
  ];

  return (
    <Sheet open={open} onClose={onClose} title="Cardio loggen">
      <div className="row wrap">
        {kinds.map((k) => (
          <button
            key={k.value}
            className={`chip${kind === k.value ? ' on' : ''}`}
            onClick={() => setKind(k.value)}
          >
            {k.label}
          </button>
        ))}
      </div>
      <div className="row-between">
        <span className="muted">Minuten</span>
        <Stepper
          value={minutes}
          onChange={setMinutes}
          step={5}
          min={5}
          max={180}
          unit="min"
          label="Minuten"
        />
      </div>
      <button
        className="btn primary lg block"
        onClick={() => {
          update((s) => {
            s.cardio = [
              ...s.cardio,
              {
                id: newId('cardio'),
                day,
                kind,
                minutes,
                loggedAt: nowISO(),
              },
            ];
          });
          tapFeedback(state.settings.celebrate);
          toast('Ik ben iemand die elke dag beweegt.', true);
          onClose();
        }}
      >
        Loggen
      </button>
    </Sheet>
  );
}
