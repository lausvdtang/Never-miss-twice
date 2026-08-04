import { useMemo, useState } from 'react';
import { Badge, Card, Check, Segment, Sheet, tapFeedback, useToast } from '../components/ui';
import {
  PREP_FORMULA,
  SPLIT_LABELS,
  defaultDayAssignment,
  splitForDays,
} from '../data/presets';
import { DAY_NAMES, today, weekKey } from '../lib/date';
import { useNav } from '../lib/nav';
import {
  availableDaysForWeek,
  completedSessionsThisWeek,
  needsCheckIn,
  weekSchedule,
} from '../lib/selectors';
import { newId, nowISO, useAppState, useUpdate } from '../lib/store';
import type { PrepComponent, PrepItem } from '../lib/types';

export function Week() {
  const state = useAppState();
  const update = useUpdate();
  const nav = useNav();
  const toast = useToast();
  const day = today();
  const week = weekKey(day);

  const [checkInOpen, setCheckInOpen] = useState(needsCheckIn(state, day));
  const [prepOpen, setPrepOpen] = useState(false);

  const checkIn = state.checkIns.find((c) => c.week === week);
  const availableDays = availableDaysForWeek(state, week);
  const split = splitForDays(availableDays);
  const schedule = useMemo(() => weekSchedule(state, day), [state, day]);
  const doneSessions = completedSessionsThisWeek(state, day);

  const prep = state.mealPrep.find((p) => p.week === week);

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">Week {week.split('-W')[1]}</p>
          <h1>{SPLIT_LABELS[split]}</h1>
        </div>
        <Badge tone="accent">
          {doneSessions}/{availableDays}
        </Badge>
      </header>

      {checkIn ? (
        <Card tone="flat">
          <div className="row-between">
            <div className="grow">
              <p className="eyebrow">Check-in gedaan</p>
              <p className="muted">
                {availableDays} dagen haalbaar · energie {checkIn.energy}/5
              </p>
              {checkIn.adjust && <p className="faint">"{checkIn.adjust}"</p>}
            </div>
            <button className="btn sm ghost" onClick={() => setCheckInOpen(true)}>
              Wijzig
            </button>
          </div>
        </Card>
      ) : (
        <Card tone="calm">
          <h3>Weekcheck-in</h3>
          <p className="muted">
            Drie vragen. Daarna weet de app welk schema deze week past.
          </p>
          <button className="btn primary lg block" onClick={() => setCheckInOpen(true)}>
            Beginnen
          </button>
        </Card>
      )}

      <Card>
        <p className="eyebrow">Je week</p>
        <div className="list">
          {schedule.map((d) => {
            const finished =
              d.session?.status === 'voltooid' || d.session?.status === 'minimaal';
            return (
              <div key={d.day} className="list-item">
                <span
                  className="faint"
                  style={{
                    width: 26,
                    fontWeight: 700,
                    color: d.day === day ? 'var(--accent)' : undefined,
                  }}
                >
                  {DAY_NAMES[d.weekday - 1]}
                </span>
                <span className="grow">
                  <span style={{ display: 'block', fontWeight: 600 }}>
                    {d.template ? d.template.name : 'Rust'}
                  </span>
                  {d.isTeachingDay && (
                    <span className="faint">Lesdag · voorkeur {d.preferredTime}</span>
                  )}
                </span>
                {finished && <Check on />}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Meal prep: basisformule + boodschappenlijst (§3B). */}
      <Card>
        <div className="card-title">
          <p className="eyebrow">Meal prep</p>
          {prep?.cookedAt && <Badge tone="accent">Gekookt</Badge>}
        </div>
        {prep && prep.items.length > 0 ? (
          <>
            <div className="list">
              {prep.items.map((item) => (
                <button
                  key={item.id}
                  className="list-item"
                  onClick={() =>
                    update((s) => {
                      s.mealPrep = s.mealPrep.map((p) =>
                        p.week === week
                          ? {
                              ...p,
                              items: p.items.map((x) =>
                                x.id === item.id ? { ...x, done: !x.done } : x,
                              ),
                            }
                          : p,
                      );
                    })
                  }
                >
                  <Check on={item.done} />
                  <span className="grow">
                    <span style={{ display: 'block', fontWeight: 600 }}>
                      {item.emergency ? '🆘 ' : ''}
                      {item.name}
                    </span>
                    <span className="faint">
                      {componentLabel(item.component)} · {item.portions} porties
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <div className="row">
              <button className="btn ghost grow" onClick={() => setPrepOpen(true)}>
                Aanpassen
              </button>
              <button
                className="btn primary grow"
                onClick={() => {
                  update((s) => {
                    s.mealPrep = s.mealPrep.map((p) =>
                      p.week === week ? { ...p, cookedAt: nowISO() } : p,
                    );
                  });
                  tapFeedback(state.settings.celebrate);
                  toast('Ik ben iemand die zijn week voorbereidt.', true);
                }}
              >
                Gekookt
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">
              Eiwitbron + koolhydraatbron + groente + smaakmaker. Eén keer koken, de rest
              van de week beslist je niets meer.
            </p>
            <button className="btn primary lg block" onClick={() => setPrepOpen(true)}>
              Prep plannen
            </button>
          </>
        )}
      </Card>

      {prep && prep.items.length > 0 && <ShoppingList week={week} />}

      <Card>
        <div className="row-between">
          <div className="grow">
            <p className="eyebrow">Lichaamsmeting</p>
            <p className="muted">Eén keer per week, vaste dag.</p>
          </div>
          <button className="btn" onClick={() => nav.go('lichaam')}>
            Openen
          </button>
        </div>
      </Card>

      <CheckInSheet
        open={checkInOpen}
        onClose={() => setCheckInOpen(false)}
        week={week}
        initialDays={availableDays}
      />
      <PrepPlanner open={prepOpen} onClose={() => setPrepOpen(false)} week={week} />
    </div>
  );
}

function componentLabel(c: PrepComponent): string {
  return PREP_FORMULA.find((f) => f.component === c)?.label ?? c;
}

/** Max. 3 vragen — geen lang formulier (§3D). */
function CheckInSheet({
  open,
  onClose,
  week,
  initialDays,
}: {
  open: boolean;
  onClose: () => void;
  week: string;
  initialDays: number;
}) {
  const state = useAppState();
  const update = useUpdate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [days, setDays] = useState(initialDays);
  const [energy, setEnergy] = useState(3);
  const [adjust, setAdjust] = useState('');

  function save() {
    update((s) => {
      const entry = {
        week,
        availableDays: days,
        energy,
        adjust: adjust.trim(),
        completedAt: nowISO(),
      };
      s.checkIns = [...s.checkIns.filter((c) => c.week !== week), entry];

      // Weekplan meteen vastleggen op basis van het antwoord.
      const split = splitForDays(days);
      const templates = s.templates
        .filter((t) => t.split === split)
        .sort((a, b) => a.order - b.order);
      const weekdays = defaultDayAssignment(days);
      s.weekPlans = [
        ...s.weekPlans.filter((p) => p.week !== week),
        {
          week,
          split,
          assignments: weekdays.map((d, i) => ({
            day: d,
            templateId: templates[i]?.id ?? templates[0]?.id ?? '',
          })),
        },
      ];
    });
    tapFeedback(state.settings.celebrate);
    toast(`Schema aangepast naar ${SPLIT_LABELS[splitForDays(days)].toLowerCase()}`, true);
    setStep(0);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Weekcheck-in">
      {step === 0 && (
        <>
          <h3>Hoeveel dagen kun je deze week trainen?</h3>
          <p className="muted">
            Eerlijk inschatten werkt beter dan optimistisch plannen. Het schema past zich
            aan.
          </p>
          <div className="row wrap">
            {[3, 4, 5, 6].map((d) => (
              <button
                key={d}
                className={`chip${days === d ? ' on' : ''}`}
                style={{ minWidth: 60, justifyContent: 'center' }}
                onClick={() => setDays(d)}
              >
                {d}
              </button>
            ))}
          </div>
          <Card tone="flat">
            <p className="muted">{SPLIT_LABELS[splitForDays(days)]}</p>
            <p className="faint">
              Elke spiergroep komt minstens 2× per week aan bod — dat blijft kloppen bij
              elk van deze schema's.
            </p>
          </Card>
          <button className="btn primary lg block" onClick={() => setStep(1)}>
            Volgende
          </button>
        </>
      )}

      {step === 1 && (
        <>
          <h3>Hoe is je energie?</h3>
          <div className="row wrap">
            {[1, 2, 3, 4, 5].map((e) => (
              <button
                key={e}
                className={`chip${energy === e ? ' on' : ''}`}
                style={{ minWidth: 54, justifyContent: 'center' }}
                onClick={() => setEnergy(e)}
              >
                {e}
              </button>
            ))}
          </div>
          <p className="faint">1 = op mijn tandvlees · 5 = topfit</p>
          <button className="btn primary lg block" onClick={() => setStep(2)}>
            Volgende
          </button>
          <button className="btn quiet block" onClick={() => setStep(0)}>
            Terug
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <h3>Wil je iets aanpassen?</h3>
          <textarea
            className="input"
            value={adjust}
            onChange={(e) => setAdjust(e.target.value)}
            placeholder="Eén zin is genoeg — of laat leeg."
          />
          <button className="btn primary lg block" onClick={save}>
            Klaar
          </button>
          <button className="btn quiet block" onClick={() => setStep(1)}>
            Terug
          </button>
        </>
      )}
    </Sheet>
  );
}

function PrepPlanner({
  open,
  onClose,
  week,
}: {
  open: boolean;
  onClose: () => void;
  week: string;
}) {
  const state = useAppState();
  const update = useUpdate();
  const toast = useToast();
  const existing = state.mealPrep.find((p) => p.week === week);
  const [items, setItems] = useState<PrepItem[]>(existing?.items ?? []);
  const [component, setComponent] = useState<PrepComponent>('eiwit');

  function add(name: string) {
    setItems((prev) => [
      ...prev,
      {
        id: newId('prep'),
        name,
        component,
        portions: 4,
        emergency: false,
        done: false,
      },
    ]);
  }

  function save() {
    update((s) => {
      const plan = {
        week,
        items,
        extras: existing?.extras ?? [],
        cookedAt: existing?.cookedAt ?? null,
      };
      s.mealPrep = [...s.mealPrep.filter((p) => p.week !== week), plan];
    });
    toast('Prep-plan opgeslagen', true);
    onClose();
  }

  const suggestions =
    PREP_FORMULA.find((f) => f.component === component)?.suggestions ?? [];

  return (
    <Sheet open={open} onClose={onClose} title="Meal prep plannen">
      <p className="muted">
        Basisformule: eiwitbron + koolhydraatbron + groente + smaakmaker. Kies per
        onderdeel wat je deze week maakt.
      </p>

      <Segment
        value={component}
        onChange={setComponent}
        ariaLabel="Onderdeel"
        options={PREP_FORMULA.map((f) => ({
          value: f.component,
          label: f.label.replace('bron', ''),
        }))}
      />

      <div className="row wrap">
        {suggestions.map((s) => (
          <button key={s} className="chip outline" onClick={() => add(s)}>
            + {s}
          </button>
        ))}
      </div>

      {items.length > 0 && (
        <Card tone="flat">
          <p className="eyebrow">Op het plan</p>
          <div className="list">
            {items.map((item) => (
              <div key={item.id} className="list-item">
                <span className="grow">
                  <span style={{ display: 'block', fontWeight: 600 }}>{item.name}</span>
                  <span className="faint">{componentLabel(item.component)}</span>
                </span>
                <button
                  className={`chip${item.emergency ? ' on' : ' outline'}`}
                  onClick={() =>
                    setItems((prev) =>
                      prev.map((x) =>
                        x.id === item.id ? { ...x, emergency: !x.emergency } : x,
                      ),
                    )
                  }
                  title="Noodmaaltijd — moet altijd klaarstaan"
                >
                  🆘
                </button>
                <div className="mini-step" style={{ width: 108 }}>
                  <button
                    onClick={() =>
                      setItems((prev) =>
                        prev.map((x) =>
                          x.id === item.id
                            ? { ...x, portions: Math.max(1, x.portions - 1) }
                            : x,
                        ),
                      )
                    }
                    aria-label="Minder porties"
                  >
                    −
                  </button>
                  <span className="val">{item.portions}</span>
                  <button
                    onClick={() =>
                      setItems((prev) =>
                        prev.map((x) =>
                          x.id === item.id ? { ...x, portions: x.portions + 1 } : x,
                        ),
                      )
                    }
                    aria-label="Meer porties"
                  >
                    +
                  </button>
                </div>
                <button
                  className="btn quiet sm"
                  aria-label="Verwijderen"
                  onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <p className="faint">
            Tik op 🆘 om iets als noodmaaltijd te markeren — dat is wat er klaarstaat op
            een slechte dag.
          </p>
        </Card>
      )}

      <button className="btn primary lg block" onClick={save} disabled={items.length === 0}>
        Opslaan
      </button>
    </Sheet>
  );
}

/** Boodschappenlijst, afgeleid van het prep-plan. */
function ShoppingList({ week }: { week: string }) {
  const state = useAppState();
  const update = useUpdate();
  const [extra, setExtra] = useState('');
  const plan = state.mealPrep.find((p) => p.week === week);
  if (!plan) return null;

  return (
    <Card>
      <div className="card-title">
        <p className="eyebrow">Boodschappenlijst</p>
        <span className="faint">
          {plan.items.length + plan.extras.length} items
        </span>
      </div>
      <div className="list">
        {plan.items.map((item) => (
          <div key={item.id} className="list-item">
            <span className="grow">
              {item.name}{' '}
              <span className="faint">× {item.portions} porties</span>
            </span>
          </div>
        ))}
        {plan.extras.map((e) => (
          <button
            key={e.id}
            className="list-item"
            onClick={() =>
              update((s) => {
                s.mealPrep = s.mealPrep.map((p) =>
                  p.week === week
                    ? {
                        ...p,
                        extras: p.extras.map((x) =>
                          x.id === e.id ? { ...x, checked: !x.checked } : x,
                        ),
                      }
                    : p,
                );
              })
            }
          >
            <Check on={e.checked} />
            <span
              className="grow"
              style={{ textDecoration: e.checked ? 'line-through' : undefined }}
            >
              {e.name}
            </span>
            <button
              className="btn quiet sm"
              aria-label="Verwijderen"
              onClick={(ev) => {
                ev.stopPropagation();
                update((s) => {
                  s.mealPrep = s.mealPrep.map((p) =>
                    p.week === week
                      ? { ...p, extras: p.extras.filter((x) => x.id !== e.id) }
                      : p,
                  );
                });
              }}
            >
              ✕
            </button>
          </button>
        ))}
      </div>
      <form
        className="row"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!extra.trim()) return;
          update((s) => {
            s.mealPrep = s.mealPrep.map((p) =>
              p.week === week
                ? {
                    ...p,
                    extras: [
                      ...p.extras,
                      { id: newId('ex'), name: extra.trim(), checked: false },
                    ],
                  }
                : p,
            );
          });
          setExtra('');
        }}
      >
        <input
          className="input grow"
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="Iets toevoegen…"
          aria-label="Boodschap toevoegen"
        />
        <button className="btn" type="submit">
          +
        </button>
      </form>
    </Card>
  );
}
