import { useMemo, useRef, useState } from 'react';
import { Badge, Card, Segment, Sheet, Stepper, useToast } from '../components/ui';
import { NOT_RECOMMENDED } from '../data/presets';
import { DAY_NAMES, DAY_NAMES_LONG } from '../lib/date';
import {
  buildCombinedCsv,
  buildCsvFiles,
  downloadText,
  exportBackup,
  openPrintableReport,
  parseBackup,
} from '../lib/export';
import { useNav } from '../lib/nav';
import {
  ACTIVITY_LABELS,
  PHASE_DESCRIPTIONS,
  PHASE_LABELS,
  estimateMaintenance,
  macroTargets,
  proteinRange,
} from '../lib/nutrition';
import { replaceState, resetAll, useAppState, useUpdate } from '../lib/store';
import type { ActivityLevel, Phase, ThemeMode } from '../lib/types';

export function Settings() {
  const state = useAppState();
  const update = useUpdate();
  const nav = useNav();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [exportOpen, setExportOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const targets = useMemo(() => macroTargets(state.profile), [state.profile]);
  const [proteinLow, proteinHigh] = proteinRange(state.profile.phase);
  const profile = state.profile;

  const setProfile = (patch: Partial<typeof profile>) =>
    update((s) => {
      s.profile = { ...s.profile, ...patch };
    });

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">Instellingen</p>
          <h1>Jouw setup</h1>
        </div>
        <button className="btn icon ghost" onClick={() => nav.go('vandaag')} aria-label="Sluiten">
          ✕
        </button>
      </header>

      <Card>
        <p className="eyebrow">Profiel</p>
        <div className="field">
          <label htmlFor="name">Naam</label>
          <input
            id="name"
            className="input"
            value={profile.name}
            onChange={(e) => setProfile({ name: e.target.value })}
            placeholder="Hoe mag de app je noemen?"
          />
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Gewicht</label>
            <Stepper
              value={profile.weightKg}
              onChange={(v) => setProfile({ weightKg: v })}
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
              value={profile.heightCm}
              onChange={(v) => setProfile({ heightCm: v })}
              step={1}
              min={130}
              max={230}
              unit="cm"
              label="Lengte"
            />
          </div>
        </div>
        <div className="field">
          <label>Geboortejaar</label>
          <Stepper
            value={profile.birthYear}
            onChange={(v) => setProfile({ birthYear: v })}
            step={1}
            min={1930}
            max={new Date().getFullYear() - 12}
            label="Geboortejaar"
          />
        </div>
        <div className="field">
          <label>Dagelijkse activiteit (buiten trainen om)</label>
          <div className="row wrap">
            {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((a) => (
              <button
                key={a}
                className={`chip${profile.activity === a ? ' on' : ''}`}
                onClick={() => setProfile({ activity: a })}
              >
                {ACTIVITY_LABELS[a]}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div className="card-title">
          <p className="eyebrow">Fase</p>
          <Badge tone="accent">{targets.kcal} kcal</Badge>
        </div>
        <Segment
          value={profile.phase}
          onChange={(v: Phase) => setProfile({ phase: v })}
          ariaLabel="Fase"
          options={(['recomp', 'leanbulk', 'cut'] as Phase[]).map((p) => ({
            value: p,
            label: PHASE_LABELS[p],
          }))}
        />
        <p className="muted">{PHASE_DESCRIPTIONS[profile.phase]}</p>
        <div className="divider" />
        <div className="row-between">
          <span className="faint">Geschat onderhoud</span>
          <span className="faint">{estimateMaintenance(profile)} kcal</span>
        </div>
        <div className="row-between">
          <span className="faint">Eiwit · vet · koolhydraten</span>
          <span className="faint">
            {targets.proteinG} · {targets.fatG} · {targets.carbsG} g
          </span>
        </div>
      </Card>

      <Card>
        <div className="card-title">
          <p className="eyebrow">Eiwit</p>
          <Badge>{profile.proteinPerKg.toFixed(1).replace('.', ',')} g/kg</Badge>
        </div>
        <Stepper
          value={profile.proteinPerKg}
          onChange={(v) => setProfile({ proteinPerKg: v })}
          step={0.1}
          min={1.2}
          max={2.6}
          unit="g per kg"
          format={(v) => v.toFixed(1).replace('.', ',')}
          label="Eiwit per kilo"
        />
        <p className="muted">
          Aanbevolen voor jouw fase: {proteinLow.toFixed(1).replace('.', ',')}-
          {proteinHigh.toFixed(1).replace('.', ',')} g/kg. Dat komt neer op{' '}
          {Math.round(profile.proteinPerKg * profile.weightKg)} g per dag.
        </p>
      </Card>

      <Card>
        <p className="eyebrow">Week en rooster</p>
        <div className="field">
          <label>Lesdagen (vroege start)</label>
          <div className="row wrap">
            {DAY_NAMES.map((name, i) => {
              const wd = i + 1;
              const on = profile.teachingDays.includes(wd);
              return (
                <button
                  key={wd}
                  className={`chip${on ? ' on' : ''}`}
                  onClick={() =>
                    setProfile({
                      teachingDays: on
                        ? profile.teachingDays.filter((d) => d !== wd)
                        : [...profile.teachingDays, wd].sort(),
                    })
                  }
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="field">
          <label>Trainen op lesdagen</label>
          <Segment
            value={profile.trainingTimeTeachingDay}
            onChange={(v: 'ochtend' | 'avond') =>
              setProfile({ trainingTimeTeachingDay: v })
            }
            options={[
              { value: 'ochtend', label: 'Vóór werk' },
              { value: 'avond', label: 'Na werk' },
            ]}
          />
        </div>
        <div className="field">
          <label>Trainen op overige dagen</label>
          <Segment
            value={profile.trainingTimeOtherDay}
            onChange={(v: 'ochtend' | 'avond' | 'flexibel') =>
              setProfile({ trainingTimeOtherDay: v })
            }
            options={[
              { value: 'ochtend', label: 'Ochtend' },
              { value: 'avond', label: 'Avond' },
              { value: 'flexibel', label: 'Flexibel' },
            ]}
          />
        </div>
        <div className="field">
          <label>Vaste weegdag</label>
          <div className="row wrap">
            {DAY_NAMES.map((name, i) => (
              <button
                key={name}
                className={`chip${profile.weighInDay === i + 1 ? ' on' : ''}`}
                onClick={() => setProfile({ weighInDay: i + 1 })}
              >
                {name}
              </button>
            ))}
          </div>
          <p className="faint">
            {DAY_NAMES_LONG[profile.weighInDay - 1]}ochtend, nuchter. Eén keer per week.
          </p>
        </div>
        <div className="field">
          <label>Stappendoel</label>
          <Stepper
            value={profile.stepGoal}
            onChange={(v) => setProfile({ stepGoal: v })}
            step={500}
            min={2000}
            max={25000}
            unit="stappen"
            label="Stappendoel"
          />
          <p className="faint">Richtlijn: 8.000-10.000 per dag als basis.</p>
        </div>
      </Card>

      <Card>
        <p className="eyebrow">Weergave</p>
        <Segment
          value={state.settings.theme}
          onChange={(v: ThemeMode) =>
            update((s) => {
              s.settings = { ...s.settings, theme: v };
            })
          }
          ariaLabel="Thema"
          options={[
            { value: 'system', label: 'Systeem' },
            { value: 'dark', label: 'Donker' },
            { value: 'light', label: 'Licht' },
          ]}
        />
        <label className="row-between" style={{ minHeight: 48 }}>
          <span className="muted">Trilling bij afvinken</span>
          <input
            type="checkbox"
            checked={state.settings.celebrate}
            onChange={(e) =>
              update((s) => {
                s.settings = { ...s.settings, celebrate: e.target.checked };
              })
            }
            style={{ width: 22, height: 22 }}
          />
        </label>
        <label className="row-between" style={{ minHeight: 48 }}>
          <span className="muted">Hint bij alcohol kort na training</span>
          <input
            type="checkbox"
            checked={state.settings.alcoholRecoveryHint}
            onChange={(e) =>
              update((s) => {
                s.settings = { ...s.settings, alcoholRecoveryHint: e.target.checked };
              })
            }
            style={{ width: 22, height: 22 }}
          />
        </label>
      </Card>

      <Card>
        <p className="eyebrow">Je data</p>
        <p className="muted">
          Alles staat op dit apparaat. Er is geen account en er gaat niets naar een
          server.
        </p>
        <div className="grid-2">
          <button className="btn" onClick={() => setExportOpen(true)}>
            Exporteren
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Herstellen
          </button>
        </div>
        <button className="btn quiet block" onClick={() => setPrivacyOpen(true)}>
          Hoe zit het met privacy?
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
              replaceState(parseBackup(await file.text()));
              toast('Back-up teruggezet', true);
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Bestand kon niet gelezen worden');
            }
          }}
        />
      </Card>

      <button className="btn quiet block" onClick={() => setResetOpen(true)}>
        Alles wissen
      </button>

      <p className="faint center">
        Never Miss Twice · alles lokaal · versie {state.version}
      </p>

      <Sheet open={exportOpen} onClose={() => setExportOpen(false)} title="Exporteren">
        <p className="muted">
          Kies wat je wilt meenemen. Alles wordt op dit apparaat gegenereerd.
        </p>
        <button
          className="btn lg block"
          onClick={() => {
            downloadText('never-miss-twice.csv', buildCombinedCsv(state));
            toast('CSV gedownload');
          }}
        >
          Alles als één CSV
        </button>
        <button
          className="btn lg block"
          onClick={() => {
            for (const f of buildCsvFiles(state)) downloadText(f.name, f.content);
            toast('CSV-bestanden gedownload');
          }}
        >
          Losse CSV per onderdeel
        </button>
        <button
          className="btn lg block"
          onClick={() => {
            if (!openPrintableReport(state)) {
              toast('Sta pop-ups toe om het rapport te openen');
            }
          }}
        >
          Overzicht als PDF (via printen)
        </button>
        <button
          className="btn lg block"
          onClick={() => {
            downloadText(
              'never-miss-twice-backup.json',
              exportBackup(state),
              'application/json',
            );
            toast('Back-up gedownload');
          }}
        >
          Volledige back-up (JSON)
        </button>
      </Sheet>

      <Sheet open={privacyOpen} onClose={() => setPrivacyOpen(false)} title="Privacy">
        <p className="muted">
          Je gezondheidsgegevens staan in de opslag van je eigen browser. Voortgangsfoto's
          staan in IndexedDB, ook lokaal. Er is geen server, geen account en geen
          synchronisatie — dus ook niets dat gelekt kan worden bij iemand anders.
        </p>
        <p className="muted">
          De keerzijde: als je je browserdata wist of van apparaat wisselt, is het weg.
          Maak af en toe een back-up via Exporteren → Volledige back-up.
        </p>
        <Card tone="flat">
          <h3>Wat de app bewust niet doet</h3>
          <p className="muted">
            Geen advertenties, geen tracking, geen aanbevelingen voor{' '}
            {NOT_RECOMMENDED.join(', ').toLowerCase()}.
          </p>
        </Card>
        <button className="btn ghost block" onClick={() => setPrivacyOpen(false)}>
          Duidelijk
        </button>
      </Sheet>

      <Sheet open={resetOpen} onClose={() => setResetOpen(false)} title="Alles wissen">
        <p className="muted">
          Dit verwijdert al je trainingen, maaltijden, metingen en gewoontes van dit
          apparaat. Dit kan niet ongedaan worden gemaakt.
        </p>
        <button
          className="btn lg block"
          style={{ background: 'var(--attention-soft)', color: 'var(--attention)' }}
          onClick={() => {
            downloadText(
              'never-miss-twice-backup.json',
              exportBackup(state),
              'application/json',
            );
            toast('Back-up gedownload — daarna pas wissen');
          }}
        >
          Eerst een back-up downloaden
        </button>
        <button
          className="btn lg block"
          style={{ background: 'var(--attention)', color: 'var(--accent-text)' }}
          onClick={() => {
            resetAll();
            setResetOpen(false);
            toast('Alles gewist');
            nav.go('vandaag');
          }}
        >
          Ja, alles wissen
        </button>
        <button className="btn quiet block" onClick={() => setResetOpen(false)}>
          Annuleren
        </button>
      </Sheet>
    </div>
  );
}
