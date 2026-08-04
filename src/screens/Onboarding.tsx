import { useState } from 'react';
import { Badge, Card, Segment, Stepper, tapFeedback } from '../components/ui';
import { HABIT_FORMATION, SPLIT_LABELS, defaultDayAssignment, splitForDays } from '../data/presets';
import { DAY_NAMES } from '../lib/date';
import { weekKey } from '../lib/date';
import { PHASE_DESCRIPTIONS, PHASE_LABELS, macroTargets } from '../lib/nutrition';
import { nowISO, useAppState, useUpdate } from '../lib/store';
import type { Phase } from '../lib/types';

/**
 * Onboarding in vijf schermen, één vraag per scherm. Alles is later te wijzigen;
 * niets hier is definitief en dat staat er ook bij.
 */
export function Onboarding() {
  const state = useAppState();
  const update = useUpdate();
  const [step, setStep] = useState(0);

  const [name, setName] = useState('');
  const [weight, setWeight] = useState(state.profile.weightKg);
  const [height, setHeight] = useState(state.profile.heightCm);
  const [birthYear, setBirthYear] = useState(state.profile.birthYear);
  const [phase, setPhase] = useState<Phase>('recomp');
  const [teachingDays, setTeachingDays] = useState<number[]>([1, 3, 5]);
  const [days, setDays] = useState(6);

  const preview = macroTargets({
    ...state.profile,
    weightKg: weight,
    heightCm: height,
    birthYear,
    phase,
  });

  function finish() {
    const week = weekKey();
    update((s) => {
      s.profile = {
        ...s.profile,
        name: name.trim(),
        weightKg: weight,
        heightCm: height,
        birthYear,
        phase,
        teachingDays,
        proteinPerKg: phase === 'cut' ? 2.0 : 1.8,
        onboarded: true,
      };
      const split = splitForDays(days);
      const templates = s.templates
        .filter((t) => t.split === split)
        .sort((a, b) => a.order - b.order);
      const weekdays = defaultDayAssignment(days);
      s.checkIns = [
        ...s.checkIns.filter((c) => c.week !== week),
        {
          week,
          availableDays: days,
          energy: 3,
          adjust: '',
          completedAt: nowISO(),
        },
      ];
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
    tapFeedback(true);
  }

  const steps = [
    /* 0 — welkom */
    <>
      <h1>Never Miss Twice</h1>
      <p className="muted">
        Een systeem in plaats van wilskracht. Je logt in een paar tikken, het schema past
        zich aan jouw week aan, en één gemiste dag is gewoon een gemiste dag.
      </p>
      <Card tone="flat">
        <h3>De enige regel</h3>
        <p className="muted">
          Nooit twee keer op rij overslaan. Eén dag missen doet niets met je gewoonte —
          twee op rij is het moment waarop de app je een kleine, concrete stap aanbiedt.
        </p>
      </Card>
      <Card tone="flat">
        <h3>Hoe lang duurt dit?</h3>
        <p className="muted">
          Gemiddeld voelt een gewoonte na zo'n {HABIT_FORMATION.averageDays} dagen
          automatisch, met een spreiding van {HABIT_FORMATION.rangeLow} tot{' '}
          {HABIT_FORMATION.rangeHigh} dagen. Met ADHD duurt het vaak langer —{' '}
          {HABIT_FORMATION.adhdMonthsLow} tot {HABIT_FORMATION.adhdMonthsHigh} maanden is
          normaal. Dat is geen probleem, dat is de spreiding.
        </p>
      </Card>
    </>,

    /* 1 — naam */
    <>
      <h1>Hoe mag ik je noemen?</h1>
      <p className="muted">Alleen voor de begroeting. Overslaan mag ook.</p>
      <input
        className="input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Je naam"
        autoFocus
      />
    </>,

    /* 2 — lichaam */
    <>
      <h1>Wat zijn je cijfers?</h1>
      <p className="muted">
        Hiermee rekent de app je calorie- en eiwitdoel uit. Later aan te passen.
      </p>
      <div className="field">
        <label>Gewicht</label>
        <Stepper
          value={weight}
          onChange={setWeight}
          step={0.5}
          min={35}
          max={250}
          unit="kg"
          format={(v) => v.toFixed(1).replace('.', ',')}
          label="Gewicht"
        />
      </div>
      <div className="field">
        <label>Lengte</label>
        <Stepper
          value={height}
          onChange={setHeight}
          step={1}
          min={130}
          max={230}
          unit="cm"
          label="Lengte"
        />
      </div>
      <div className="field">
        <label>Geboortejaar</label>
        <Stepper
          value={birthYear}
          onChange={setBirthYear}
          step={1}
          min={1930}
          max={new Date().getFullYear() - 12}
          label="Geboortejaar"
        />
      </div>
    </>,

    /* 3 — fase */
    <>
      <h1>Wat is je doel nu?</h1>
      <Segment
        value={phase}
        onChange={setPhase}
        ariaLabel="Fase"
        options={(['recomp', 'leanbulk', 'cut'] as Phase[]).map((p) => ({
          value: p,
          label: PHASE_LABELS[p],
        }))}
      />
      <p className="muted">{PHASE_DESCRIPTIONS[phase]}</p>
      <Card tone="flat">
        <div className="row-between">
          <span className="muted">Je dagbudget wordt</span>
          <Badge tone="accent">{preview.kcal} kcal</Badge>
        </div>
        <div className="row-between">
          <span className="faint">Eiwit</span>
          <span className="faint">{preview.proteinG} g per dag</span>
        </div>
      </Card>
      <p className="faint">
        Zichtbare buikspieren komen voor ongeveer 90% uit een laag vetpercentage en maar
        10% uit abs-training. Het richtpunt is 10-12% lichaamsvet.
      </p>
    </>,

    /* 4 — rooster */
    <>
      <h1>Hoe ziet je week eruit?</h1>
      <div className="field">
        <label>Op welke dagen sta je voor de klas?</label>
        <div className="row wrap">
          {DAY_NAMES.map((n, i) => {
            const wd = i + 1;
            const on = teachingDays.includes(wd);
            return (
              <button
                key={wd}
                className={`chip${on ? ' on' : ''}`}
                onClick={() =>
                  setTeachingDays(
                    on ? teachingDays.filter((d) => d !== wd) : [...teachingDays, wd].sort(),
                  )
                }
              >
                {n}
              </button>
            );
          })}
        </div>
        <p className="faint">
          Op lesdagen krijg je de voorkeur om vóór het werk te trainen.
        </p>
      </div>
      <div className="field">
        <label>Hoeveel dagen wil je deze week trainen?</label>
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
      </div>
      <Card tone="flat">
        <h3>{SPLIT_LABELS[splitForDays(days)]}</h3>
        <p className="muted">
          Elke spiergroep komt minstens 2× per week aan bod. Volgende week kun je dit
          aantal bij de check-in gewoon weer bijstellen.
        </p>
      </Card>
    </>,
  ];

  const isLast = step === steps.length - 1;

  return (
    <div className="screen">
      <div className="row" style={{ gap: 4 }}>
        {steps.map((_, i) => (
          <div
            key={i}
            style={{
              height: 4,
              flex: 1,
              borderRadius: 999,
              background: i <= step ? 'var(--accent)' : 'var(--surface-3)',
              transition: 'background 0.2s ease',
            }}
          />
        ))}
      </div>

      <div className="stack" style={{ flex: 1 }}>
        {steps[step]}
      </div>

      <button
        className="btn primary xl block"
        onClick={() => (isLast ? finish() : setStep(step + 1))}
      >
        {isLast ? 'Beginnen' : 'Volgende'}
      </button>
      {step > 0 && (
        <button className="btn quiet block" onClick={() => setStep(step - 1)}>
          Terug
        </button>
      )}
    </div>
  );
}
