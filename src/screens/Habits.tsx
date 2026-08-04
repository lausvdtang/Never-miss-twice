import { useMemo, useState } from 'react';
import {
  Badge,
  Card,
  Check,
  Sheet,
  StreakStrip,
  plural,
  tapFeedback,
  useToast,
} from '../components/ui';
import { HABIT_FORMATION, INTENTION_TEMPLATES } from '../data/presets';
import { DAY_NAMES, today } from '../lib/date';
import { completionMessage } from '../lib/habits';
import { habitStates } from '../lib/selectors';
import { newId, nowISO, useAppState, useUpdate } from '../lib/store';
import type { Habit } from '../lib/types';

export function Habits() {
  const state = useAppState();
  const update = useUpdate();
  const toast = useToast();
  const day = today();

  const [editing, setEditing] = useState<Habit | null>(null);
  const [creating, setCreating] = useState(false);
  const [intentionOpen, setIntentionOpen] = useState(false);

  const states = useMemo(() => habitStates(state, day), [state, day]);

  function toggle(habitId: string, minimal: boolean) {
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
            { habitId, day, completion: minimal ? 'minimaal' : 'vol', loggedAt: nowISO() },
          ];
    });
    if (!existing) {
      tapFeedback(state.settings.celebrate);
      toast(completionMessage(habit, minimal), true);
    }
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">Gewoontes</p>
          <h1>Wie je bent, elke dag</h1>
        </div>
        <button
          className="btn icon ghost"
          onClick={() => setCreating(true)}
          aria-label="Gewoonte toevoegen"
        >
          +
        </button>
      </header>

      {states.map((s) => (
        <Card key={s.habit.id}>
          <div className="card-title">
            <div className="grow">
              <h3>
                {s.habit.icon} {s.habit.name}
              </h3>
              <p className="faint">{s.habit.identity}</p>
            </div>
            {s.streak > 0 && <Badge tone="accent">{plural(s.streak, 'dag', 'dagen')}</Badge>}
          </div>

          <StreakStrip days={s.recent} />

          <div className="row-between">
            <span className="faint">
              {s.last30}× in de laatste 30 dagen
              {s.bestStreak > s.streak ? ` · beste ${s.bestStreak}` : ''}
            </span>
            {s.habit.autoSource && <Badge tone="calm">automatisch</Badge>}
          </div>

          {/* Never miss twice: mild bij één misser, actief bij twee. */}
          {s.status === 'een_gemist' && !s.doneToday && (
            <p className="muted">
              Gisteren overgeslagen. Eén dag verandert niets aan je gewoonte — vandaag
              gewoon weer.
            </p>
          )}
          {s.status === 'herstel' && !s.doneToday && (
            <Card tone="attention">
              <p className="muted">
                Twee dagen op rij overgeslagen. Doe vandaag de kleinste versie:{' '}
                {s.habit.minimalVersion}
              </p>
            </Card>
          )}

          {s.activeToday ? (
            <div className="row">
              <button
                className={`btn ${s.doneToday ? 'ghost' : 'primary'} grow`}
                onClick={() => toggle(s.habit.id, false)}
                disabled={!!s.habit.autoSource && s.doneToday}
              >
                <Check on={s.doneToday} />
                {s.doneToday ? 'Gedaan' : 'Afvinken'}
              </button>
              {!s.doneToday && (
                <button className="btn ghost" onClick={() => toggle(s.habit.id, true)}>
                  Minimale versie
                </button>
              )}
            </div>
          ) : (
            <p className="faint">Vandaag niet ingepland voor deze gewoonte.</p>
          )}

          <button className="btn quiet sm" onClick={() => setEditing(s.habit)}>
            Anker en instellingen
          </button>
        </Card>
      ))}

      {/* Implementation intentions (§3D). */}
      <Card>
        <div className="card-title">
          <p className="eyebrow">Als-dan-regels</p>
          <button className="btn quiet sm" onClick={() => setIntentionOpen(true)}>
            + Nieuw
          </button>
        </div>
        <p className="muted">
          Vooraf bedacht, zodat je in het moment niet hoeft na te denken.
        </p>
        {state.intentions.length === 0 ? (
          <p className="empty">
            Nog geen regels. Eén goede regel voor je meest voorspelbare obstakel is
            genoeg om te beginnen.
          </p>
        ) : (
          <div className="list">
            {state.intentions.map((i) => (
              <div key={i.id} className="list-item">
                <span className="grow">
                  <span style={{ display: 'block', fontWeight: 600 }}>{i.trigger}</span>
                  <span className="faint">→ {i.action}</span>
                </span>
                <button
                  className="btn quiet sm"
                  aria-label="Regel verwijderen"
                  onClick={() =>
                    update((s) => {
                      s.intentions = s.intentions.filter((x) => x.id !== i.id);
                    })
                  }
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card tone="flat">
        <p className="muted">
          Een gewoonte voelt gemiddeld na zo'n {HABIT_FORMATION.averageDays} dagen
          automatisch — met een spreiding van {HABIT_FORMATION.rangeLow} tot{' '}
          {HABIT_FORMATION.rangeHigh} dagen. Met ADHD duurt het vaak wat langer,
          richting {HABIT_FORMATION.adhdMonthsLow}-{HABIT_FORMATION.adhdMonthsHigh}{' '}
          maanden. Dat is geen falen, dat is gewoon de spreiding.
        </p>
      </Card>

      <HabitEditor
        habit={editing}
        onClose={() => setEditing(null)}
        onSave={(next) => {
          update((s) => {
            s.habits = s.habits.map((h) => (h.id === next.id ? next : h));
          });
          setEditing(null);
          toast('Opgeslagen');
        }}
        onDelete={(id) => {
          update((s) => {
            s.habits = s.habits.map((h) => (h.id === id ? { ...h, archived: true } : h));
          });
          setEditing(null);
          toast('Gewoonte gearchiveerd');
        }}
      />

      <NewHabitSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={(habit) => {
          update((s) => {
            s.habits = [...s.habits, habit];
          });
          setCreating(false);
          toast('Gewoonte toegevoegd', true);
        }}
      />

      <IntentionSheet
        open={intentionOpen}
        onClose={() => setIntentionOpen(false)}
        onCreate={(trigger, action) => {
          update((s) => {
            s.intentions = [
              ...s.intentions,
              {
                id: newId('int'),
                trigger,
                action,
                timesUsed: 0,
                createdAt: nowISO(),
              },
            ];
          });
          setIntentionOpen(false);
          toast('Regel opgeslagen', true);
        }}
      />
    </div>
  );
}

function HabitEditor({
  habit,
  onClose,
  onSave,
  onDelete,
}: {
  habit: Habit | null;
  onClose: () => void;
  onSave: (h: Habit) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Habit | null>(habit);

  // Houd het formulier in sync met de geselecteerde gewoonte.
  if (habit && draft?.id !== habit.id) setDraft(habit);
  if (!habit || !draft) return null;

  return (
    <Sheet open={!!habit} onClose={onClose} title={draft.name}>
      <div className="field">
        <label>Identiteit — "Ik ben iemand die…"</label>
        <input
          className="input"
          value={draft.identity}
          onChange={(e) => setDraft({ ...draft, identity: e.target.value })}
        />
      </div>
      <div className="field">
        <label>Anker — waar plak je het aan vast?</label>
        <input
          className="input"
          value={draft.anchor}
          onChange={(e) => setDraft({ ...draft, anchor: e.target.value })}
          placeholder="Bijv. na het avondeten"
        />
        <p className="faint">
          Een gewoonte aan een bestaand moment koppelen werkt beter dan een tijdstip
          prikken.
        </p>
      </div>
      <div className="field">
        <label>Minimale versie — wat telt op een slechte dag?</label>
        <input
          className="input"
          value={draft.minimalVersion}
          onChange={(e) => setDraft({ ...draft, minimalVersion: e.target.value })}
        />
      </div>
      <div className="field">
        <label>Op welke dagen telt dit?</label>
        <div className="row wrap">
          {DAY_NAMES.map((name, i) => {
            const wd = i + 1;
            const on = draft.activeDays.length === 0 || draft.activeDays.includes(wd);
            return (
              <button
                key={wd}
                className={`chip${on ? ' on' : ''}`}
                onClick={() => {
                  const current =
                    draft.activeDays.length === 0 ? [1, 2, 3, 4, 5, 6, 7] : draft.activeDays;
                  const next = current.includes(wd)
                    ? current.filter((d) => d !== wd)
                    : [...current, wd].sort();
                  setDraft({ ...draft, activeDays: next.length === 7 ? [] : next });
                }}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>
      <button className="btn primary lg block" onClick={() => onSave(draft)}>
        Opslaan
      </button>
      <button className="btn quiet block" onClick={() => onDelete(draft.id)}>
        Gewoonte archiveren
      </button>
    </Sheet>
  );
}

function NewHabitSheet({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (h: Habit) => void;
}) {
  const [identity, setIdentity] = useState('');
  const [name, setName] = useState('');
  const [anchor, setAnchor] = useState('');
  const [minimal, setMinimal] = useState('');

  function create() {
    if (!name.trim()) return;
    onCreate({
      id: newId('hab'),
      identity: identity.trim() || `Ik ben iemand die ${name.trim().toLowerCase()} doet`,
      name: name.trim(),
      anchor: anchor.trim(),
      minimalVersion: minimal.trim() || 'De kleinst mogelijke versie telt.',
      activeDays: [],
      icon: '✅',
      archived: false,
      createdAt: nowISO(),
      autoSource: null,
    });
    setIdentity('');
    setName('');
    setAnchor('');
    setMinimal('');
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nieuwe gewoonte">
      <div className="field">
        <label>Naam</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bijv. Water bij het ontbijt"
        />
      </div>
      <div className="field">
        <label>Ik ben iemand die…</label>
        <input
          className="input"
          value={identity}
          onChange={(e) => setIdentity(e.target.value)}
          placeholder="Ik ben iemand die goed voor zichzelf zorgt"
        />
      </div>
      <div className="field">
        <label>Anker — na welk bestaand moment?</label>
        <input
          className="input"
          value={anchor}
          onChange={(e) => setAnchor(e.target.value)}
          placeholder="Na het tandenpoetsen"
        />
      </div>
      <div className="field">
        <label>Minimale versie</label>
        <input
          className="input"
          value={minimal}
          onChange={(e) => setMinimal(e.target.value)}
          placeholder="Eén slok telt"
        />
      </div>
      <button className="btn primary lg block" onClick={create} disabled={!name.trim()}>
        Toevoegen
      </button>
    </Sheet>
  );
}

function IntentionSheet({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (trigger: string, action: string) => void;
}) {
  const [trigger, setTrigger] = useState('');
  const [action, setAction] = useState('');

  return (
    <Sheet open={open} onClose={onClose} title="Als-dan-regel">
      <p className="muted">
        Kies een voorbeeld of schrijf je eigen regel. Concreet werkt beter dan algemeen.
      </p>
      <div className="stack-sm">
        {INTENTION_TEMPLATES.map((t) => (
          <button
            key={t.trigger}
            className="btn block"
            style={{
              justifyContent: 'flex-start',
              padding: '10px 14px',
              height: 'auto',
              minHeight: 56,
              textAlign: 'left',
            }}
            onClick={() => {
              setTrigger(t.trigger);
              setAction(t.action);
            }}
          >
            <span>
              <span style={{ display: 'block', fontWeight: 600 }}>{t.trigger}</span>
              <span className="faint">{t.action}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="divider" />
      <div className="field">
        <label>Als…</label>
        <input
          className="input"
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
          placeholder="Als het regent"
        />
      </div>
      <div className="field">
        <label>Dan…</label>
        <input
          className="input"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="dan doe ik 15 min bodyweight thuis"
        />
      </div>
      <button
        className="btn primary lg block"
        disabled={!trigger.trim() || !action.trim()}
        onClick={() => {
          onCreate(trigger.trim(), action.trim());
          setTrigger('');
          setAction('');
        }}
      >
        Opslaan
      </button>
    </Sheet>
  );
}
