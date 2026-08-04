import { useMemo, useState } from 'react';
import { Badge, Card, MacroRow, Ring, Sheet, useToast } from '../components/ui';
import { ALCOHOL_PRESETS, NOT_RECOMMENDED } from '../data/presets';
import { formatDayShort, today, weekDays } from '../lib/date';
import { useNav } from '../lib/nav';
import {
  eightyTwenty,
  macroTargets,
  proteinPerMeal,
  PHASE_LABELS,
} from '../lib/nutrition';
import {
  alcoholOn,
  dailyTotals,
  mealsOn,
  weekAlcohol,
  weekMeals,
} from '../lib/selectors';
import { useAppState, useUpdate } from '../lib/store';
import { hoursSinceLastSession } from '../lib/training';
import { AlcoholSheet } from './sheets/AlcoholSheet';
import { QuickFoodSheet } from './sheets/QuickFoodSheet';

export function Nutrition() {
  const state = useAppState();
  const update = useUpdate();
  const nav = useNav();
  const toast = useToast();
  const day = today();

  const [foodOpen, setFoodOpen] = useState(false);
  const [alcoholOpen, setAlcoholOpen] = useState(false);
  const [suppOpen, setSuppOpen] = useState(false);

  const targets = useMemo(() => macroTargets(state.profile), [state.profile]);
  const totals = useMemo(() => dailyTotals(state, day), [state, day]);
  const meals = mealsOn(state, day);
  const drinks = alcoholOn(state, day);

  const balance = useMemo(
    () => eightyTwenty(weekMeals(state, day), weekAlcohol(state, day), targets.kcal * 7),
    [state, day, targets.kcal],
  );

  const perMeal = proteinPerMeal(targets.proteinG);
  const kcalLeft = targets.kcal - totals.kcal;

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">Voeding · {PHASE_LABELS[state.profile.phase]}</p>
          <h1>{Math.max(0, Math.round(kcalLeft))} kcal te gaan</h1>
        </div>
        <button
          className="btn icon ghost"
          onClick={() => nav.go('instellingen')}
          aria-label="Doelen aanpassen"
        >
          ⚙︎
        </button>
      </header>

      <Card>
        <div className="ring-wrap">
          <Ring
            value={totals.kcal}
            max={targets.kcal}
            size={104}
            label={String(Math.round(totals.kcal))}
            unit={`van ${targets.kcal}`}
          />
          <div className="grow stack-sm">
            <MacroRow name="Eiwit" value={totals.proteinG} target={targets.proteinG} />
            <MacroRow
              name="Koolh."
              value={totals.carbsG}
              target={targets.carbsG}
              color="var(--calm)"
            />
            <MacroRow
              name="Vet"
              value={totals.fatG}
              target={targets.fatG}
              color="var(--free)"
            />
          </div>
        </div>
        <p className="faint">
          Mik op {perMeal.meals} maaltijden van ongeveer {perMeal.perMeal} g eiwit.
        </p>
        <div className="grid-2">
          <button className="btn primary lg" onClick={() => setFoodOpen(true)}>
            + Eten
          </button>
          <button className="btn lg free" onClick={() => setAlcoholOpen(true)}>
            + Drinken
          </button>
        </div>
      </Card>

      {/* 80/20 als weekbalans, niet als dagelijks stoplicht (§8.3). */}
      <Card>
        <div className="card-title">
          <p className="eyebrow">80/20 deze week</p>
          <Badge tone={balance.onTrack ? 'accent' : 'free'}>
            {balance.basePct}% basis
          </Badge>
        </div>
        <div className="bar" style={{ height: 14 }}>
          <div
            className="bar-fill"
            style={{
              width: `${balance.totalKcal ? (balance.baseKcal / balance.totalKcal) * 100 : 100}%`,
              background: 'var(--accent)',
              borderRadius: 0,
            }}
          />
          <div
            className="bar-fill"
            style={{
              width: `${balance.totalKcal ? (balance.freeKcal / balance.totalKcal) * 100 : 0}%`,
              background: 'var(--free)',
              borderRadius: 0,
            }}
          />
        </div>
        <div className="row-between">
          <span className="faint">
            Vrij besteed: {balance.freeKcal.toLocaleString('nl-NL')} kcal
          </span>
          <span className="faint">
            Budget: {balance.freeBudget.toLocaleString('nl-NL')} kcal
          </span>
        </div>
        <p className="muted">
          {balance.freeRemaining >= 0
            ? `Nog ${balance.freeRemaining.toLocaleString('nl-NL')} kcal vrij te besteden deze week. Snacks en bier vallen hieronder — geen verboden producten, alleen een budget.`
            : `Je zit ${Math.abs(balance.freeRemaining).toLocaleString('nl-NL')} kcal boven je vrije budget. Volgende week schuift dat vanzelf weer terug — dit is een weekbalans, geen cijfer per dag.`}
        </p>
      </Card>

      {/* Vandaag gelogd, met snelle verwijderoptie. */}
      <Card>
        <div className="card-title">
          <p className="eyebrow">Vandaag gelogd</p>
          <span className="faint">{meals.length + drinks.length} items</span>
        </div>
        {meals.length === 0 && drinks.length === 0 ? (
          <p className="empty">Nog niets gelogd vandaag.</p>
        ) : (
          <div className="list">
            {meals.map((m) => (
              <div key={m.id} className="list-item">
                <span className="grow">
                  <span style={{ display: 'block', fontWeight: 600 }}>
                    {m.name}
                    {m.servings !== 1 ? ` ×${String(m.servings).replace('.', ',')}` : ''}
                  </span>
                  <span className="faint">
                    {Math.round(m.kcal * m.servings)} kcal ·{' '}
                    {Math.round(m.proteinG * m.servings)} g eiwit
                  </span>
                </span>
                {m.quality === 'vrij' && <Badge tone="free">20%</Badge>}
                <button
                  className="btn quiet sm"
                  aria-label={`${m.name} verwijderen`}
                  onClick={() => {
                    update((s) => {
                      s.meals = s.meals.filter((x) => x.id !== m.id);
                    });
                    toast('Verwijderd');
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            {drinks.map((a) => (
              <div key={a.id} className="list-item">
                <span className="grow">
                  <span style={{ display: 'block', fontWeight: 600 }}>
                    {a.name}
                    {a.count > 1 ? ` ×${a.count}` : ''}
                  </span>
                  <span className="faint">
                    {Math.round(a.kcal * a.count)} kcal ·{' '}
                    {(a.standardGlasses * a.count).toFixed(1).replace('.', ',')}{' '}
                    standaardglazen
                  </span>
                </span>
                <Badge tone="free">20%</Badge>
                <button
                  className="btn quiet sm"
                  aria-label={`${a.name} verwijderen`}
                  onClick={() => {
                    update((s) => {
                      s.alcohol = s.alcohol.filter((x) => x.id !== a.id);
                    });
                    toast('Verwijderd');
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Weekoverzicht per dag: puur informatief, zonder oordeel. */}
      <Card>
        <p className="eyebrow">Deze week</p>
        <div className="list">
          {weekDays(day).map((d) => {
            const t = dailyTotals(state, d);
            const isFuture = d > day;
            return (
              <div key={d} className="list-item">
                <span className="faint" style={{ width: 58 }}>
                  {formatDayShort(d)}
                </span>
                <span className="grow">
                  <div className="bar">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${Math.min(100, (t.kcal / targets.kcal) * 100)}%`,
                        background: isFuture ? 'var(--surface-3)' : 'var(--accent)',
                      }}
                    />
                  </div>
                </span>
                <span className="faint" style={{ minWidth: 52, textAlign: 'right' }}>
                  {t.kcal > 0 ? Math.round(t.kcal) : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="row-between">
          <div className="grow">
            <p className="eyebrow">Meal prep</p>
            <p className="muted">Batch koken en je boodschappenlijst.</p>
          </div>
          <button className="btn" onClick={() => nav.go('week')}>
            Openen
          </button>
        </div>
      </Card>

      <button className="btn quiet block" onClick={() => setSuppOpen(true)}>
        Over supplementen
      </button>

      <Sheet open={suppOpen} onClose={() => setSuppOpen(false)} title="Supplementen">
        <div className="stack">
          {state.supplements
            .sort((a, b) => a.priority - b.priority)
            .map((s) => (
              <Card key={s.key} tone="flat">
                <div className="row-between">
                  <div className="grow">
                    <h3>{s.name}</h3>
                    <p className="faint">{s.dose}</p>
                  </div>
                  <button
                    className={`chip${s.enabled ? ' on' : ''}`}
                    onClick={() =>
                      update((st) => {
                        st.supplements = st.supplements.map((x) =>
                          x.key === s.key ? { ...x, enabled: !x.enabled } : x,
                        );
                      })
                    }
                  >
                    {s.enabled ? 'Aan' : 'Uit'}
                  </button>
                </div>
                {s.hint && <p className="muted">{s.hint}</p>}
              </Card>
            ))}
        </div>
        <Card tone="flat">
          <h3>Niet nodig</h3>
          <p className="muted">
            {NOT_RECOMMENDED.join(', ')} — geen bewezen meerwaarde. Die staan er bewust
            niet in.
          </p>
        </Card>
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
