import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Card, Sheet, Stepper, tapFeedback, useToast } from '../components/ui';
import { BODY_FAT_TARGET } from '../data/presets';
import { DAY_NAMES_LONG, formatDayShort, today } from '../lib/date';
import { bodyFatNote, trend, trendInsight, weighInGate } from '../lib/body';
import {
  deletePhoto,
  loadPhoto,
  newId,
  nowISO,
  savePhoto,
  useAppState,
  useUpdate,
} from '../lib/store';
import type { TrendPoint } from '../lib/body';

export function Body() {
  const state = useAppState();
  const update = useUpdate();
  const toast = useToast();
  const day = today();

  const [open, setOpen] = useState(false);
  const [why, setWhy] = useState(false);
  const [weight, setWeight] = useState(state.profile.weightKg);
  const [bodyFat, setBodyFat] = useState<number>(18);
  const [muscle, setMuscle] = useState<number>(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const gate = useMemo(
    () => weighInGate(state.weighIns, state.profile.weighInDay, day),
    [state.weighIns, state.profile.weighInDay, day],
  );
  const points = useMemo(() => trend(state.weighIns), [state.weighIns]);
  const insight = useMemo(
    () => trendInsight(state.weighIns, state.profile.phase),
    [state.weighIns, state.profile.phase],
  );
  const latest = points[points.length - 1];

  function save() {
    const id = newId('weigh');
    update((s) => {
      s.weighIns = [
        ...s.weighIns,
        {
          id,
          day,
          weightKg: weight,
          bodyFatPct: bodyFat > 0 ? bodyFat : undefined,
          muscleMassKg: muscle > 0 ? muscle : undefined,
          loggedAt: nowISO(),
        },
      ];
      // Het profielgewicht volgt de meting, zodat macro's meebewegen.
      s.profile = { ...s.profile, weightKg: weight };
    });
    setOpen(false);
    tapFeedback(state.settings.celebrate);
    toast('Meting opgeslagen. Volgende week weer.', true);
  }

  async function addPhoto(file: File) {
    const key = `photo_${Date.now()}`;
    await savePhoto(key, file);
    update((s) => {
      s.photos = [...s.photos, { id: newId('ph'), day, blobKey: key }];
    });
    toast('Foto lokaal opgeslagen.');
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">Lichaam</p>
          <h1>
            {latest
              ? `${latest.average.toFixed(1).replace('.', ',')} kg`
              : 'Nog geen meting'}
          </h1>
          {latest && <p className="faint">Voortschrijdend gemiddelde, niet je laatste getal.</p>}
        </div>
        {insight && (
          <Badge tone={insight.direction === 'stabiel' ? 'calm' : 'accent'}>
            {insight.kgPerWeek > 0 ? '+' : ''}
            {insight.kgPerWeek.toFixed(2).replace('.', ',')} kg/wk
          </Badge>
        )}
      </header>

      {/* De harde 1×-per-week-regel (§8.6) staat hier centraal. */}
      <Card tone={gate.allowed ? undefined : 'flat'}>
        <div className="card-title">
          <p className="eyebrow">Weegmoment</p>
          <Badge tone="calm">
            {DAY_NAMES_LONG[state.profile.weighInDay - 1]}ochtend
          </Badge>
        </div>
        <p className="muted">{gate.reason}</p>
        {gate.allowed ? (
          <button
            className="btn primary lg block"
            onClick={() => {
              setWeight(state.profile.weightKg);
              setOpen(true);
            }}
          >
            Meting invoeren
          </button>
        ) : (
          <>
            <div className="row-between">
              <span className="faint">Volgende meting</span>
              <span className="faint">
                over {gate.daysUntilNext} {gate.daysUntilNext === 1 ? 'dag' : 'dagen'}
              </span>
            </div>
            <button className="btn quiet block" onClick={() => setWhy(true)}>
              Waarom maar één keer per week?
            </button>
          </>
        )}
      </Card>

      {points.length >= 2 && <TrendChart points={points} />}

      {insight?.tip && (
        <Card tone="calm">
          <h3>Kleine bijstelling</h3>
          <p className="muted">{insight.tip}</p>
        </Card>
      )}

      {latest?.bodyFatPct !== undefined && (
        <Card>
          <div className="card-title">
            <p className="eyebrow">Vetpercentage</p>
            <Badge tone="accent">{latest.bodyFatPct.toFixed(1).replace('.', ',')}%</Badge>
          </div>
          <p className="muted">{bodyFatNote(latest.bodyFatPct)}</p>
          <p className="faint">
            Richtpunt voor zichtbare buikspieren: {BODY_FAT_TARGET.min}-
            {BODY_FAT_TARGET.max}%.
          </p>
        </Card>
      )}

      <Card>
        <div className="card-title">
          <p className="eyebrow">Voortgangsfoto's</p>
          <span className="faint">{state.photos.length}</span>
        </div>
        <p className="muted">
          Privé en alleen op dit apparaat. Ze worden nergens naartoe gestuurd.
        </p>
        {state.photos.length > 0 && (
          <div className="grid-3">
            {state.photos
              .slice()
              .reverse()
              .slice(0, 9)
              .map((p) => (
                <PhotoThumb
                  key={p.id}
                  blobKey={p.blobKey}
                  day={p.day}
                  onDelete={async () => {
                    await deletePhoto(p.blobKey);
                    update((s) => {
                      s.photos = s.photos.filter((x) => x.id !== p.id);
                    });
                    toast('Foto verwijderd');
                  }}
                />
              ))}
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void addPhoto(file);
            e.target.value = '';
          }}
        />
        <button className="btn ghost block" onClick={() => fileRef.current?.click()}>
          Foto toevoegen
        </button>
      </Card>

      {state.weighIns.length > 0 && (
        <Card>
          <p className="eyebrow">Alle metingen</p>
          <div className="list">
            {[...state.weighIns]
              .sort((a, b) => b.day.localeCompare(a.day))
              .map((w) => (
                <div key={w.id} className="list-item">
                  <span className="faint" style={{ width: 62 }}>
                    {formatDayShort(w.day)}
                  </span>
                  <span className="grow" style={{ fontWeight: 600 }}>
                    {w.weightKg.toFixed(1).replace('.', ',')} kg
                  </span>
                  {w.bodyFatPct !== undefined && (
                    <span className="faint">{w.bodyFatPct.toFixed(1).replace('.', ',')}%</span>
                  )}
                  <button
                    className="btn quiet sm"
                    aria-label="Meting verwijderen"
                    onClick={() =>
                      update((s) => {
                        s.weighIns = s.weighIns.filter((x) => x.id !== w.id);
                      })
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
          </div>
        </Card>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Meting invoeren">
        {!gate.isWeighDay && (
          <Card tone="calm">
            <p className="muted">
              Het is niet je vaste weegdag. Kan prima — houd het alleen consequent, anders
              vergelijk je appels met peren.
            </p>
          </Card>
        )}
        <div className="field">
          <label>Gewicht</label>
          <Stepper
            value={weight}
            onChange={setWeight}
            step={0.1}
            min={30}
            max={250}
            unit="kg"
            format={(v) => v.toFixed(1).replace('.', ',')}
            label="Gewicht"
          />
        </div>
        <div className="field">
          <label>Vetpercentage (optioneel, van de BIA-weegschaal)</label>
          <Stepper
            value={bodyFat}
            onChange={setBodyFat}
            step={0.1}
            min={0}
            max={60}
            unit="%"
            format={(v) => (v === 0 ? '—' : v.toFixed(1).replace('.', ','))}
            label="Vetpercentage"
          />
        </div>
        <div className="field">
          <label>Spiermassa (optioneel)</label>
          <Stepper
            value={muscle}
            onChange={setMuscle}
            step={0.1}
            min={0}
            max={120}
            unit="kg"
            format={(v) => (v === 0 ? '—' : v.toFixed(1).replace('.', ','))}
            label="Spiermassa"
          />
        </div>
        <button className="btn primary lg block" onClick={save}>
          Opslaan
        </button>
        <p className="faint center">
          Ochtend, nuchter, na het toilet, vóór eten en drinken.
        </p>
      </Sheet>

      <Sheet open={why} onClose={() => setWhy(false)} title="Waarom één keer per week?">
        <p className="muted">
          Je gewicht schommelt dagelijks met een kilo of meer door vocht, glycogeen en
          wat er nog in je darmen zit. Dat is ruis, geen voortgang.
        </p>
        <p className="muted">
          Wie dagelijks weegt, reageert op die ruis: eerst blij, dan gefrustreerd, en
          uiteindelijk stopt-ie. Eén meting per week onder dezelfde omstandigheden, en
          dan kijken naar het gemiddelde over 3-4 weken — dat is het signaal waar je
          iets aan hebt.
        </p>
        <Card tone="flat">
          <h3>Zelfde omstandigheden</h3>
          <p className="muted">
            Ochtend, nuchter, na het toilet, vóór eten en drinken. Elke week hetzelfde.
          </p>
        </Card>
        <button className="btn ghost block" onClick={() => setWhy(false)}>
          Duidelijk
        </button>
      </Sheet>
    </div>
  );
}

/** Lijngrafiek met losse metingen als punten en het gemiddelde als lijn. */
function TrendChart({ points }: { points: TrendPoint[] }) {
  const width = 320;
  const height = 150;
  const pad = { top: 12, right: 8, bottom: 20, left: 30 };

  const values = points.flatMap((p) => [p.weightKg, p.average]);
  const min = Math.min(...values) - 0.6;
  const max = Math.max(...values) + 0.6;
  const span = Math.max(0.1, max - min);

  const x = (i: number) =>
    pad.left +
    (points.length === 1
      ? 0
      : (i / (points.length - 1)) * (width - pad.left - pad.right));
  const y = (v: number) =>
    pad.top + (1 - (v - min) / span) * (height - pad.top - pad.bottom);

  const avgPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.average).toFixed(1)}`)
    .join(' ');

  return (
    <Card>
      <div className="card-title">
        <p className="eyebrow">Trend</p>
        <span className="faint">Gemiddelde over 4 metingen</span>
      </div>
      <svg
        className="chart"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Gewichtstrend"
      >
        <line
          x1={pad.left}
          y1={height - pad.bottom}
          x2={width - pad.right}
          y2={height - pad.bottom}
          stroke="var(--border)"
        />
        <text x={2} y={y(max - 0.6) + 4} fontSize="9" fill="var(--text-faint)">
          {(max - 0.6).toFixed(1).replace('.', ',')}
        </text>
        <text x={2} y={y(min + 0.6) + 4} fontSize="9" fill="var(--text-faint)">
          {(min + 0.6).toFixed(1).replace('.', ',')}
        </text>

        {/* Losse metingen: bewust klein en licht — het gaat om de lijn. */}
        {points.map((p, i) => (
          <circle
            key={p.day}
            cx={x(i)}
            cy={y(p.weightKg)}
            r={2.5}
            fill="var(--text-faint)"
            opacity={0.55}
          />
        ))}

        <path
          d={avgPath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.length > 0 && (
          <circle
            cx={x(points.length - 1)}
            cy={y(points[points.length - 1].average)}
            r={4}
            fill="var(--accent)"
          />
        )}
      </svg>
      <div className="row-between">
        <span className="faint">{formatDayShort(points[0].day)}</span>
        <span className="faint">{formatDayShort(points[points.length - 1].day)}</span>
      </div>
    </Card>
  );
}

function PhotoThumb({
  blobKey,
  day,
  onDelete,
}: {
  blobKey: string;
  day: string;
  onDelete: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    void loadPhoto(blobKey).then((blob) => {
      if (!blob || cancelled) return;
      const objectUrl = URL.createObjectURL(blob);
      revoked = objectUrl;
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [blobKey]);

  return (
    <button
      onClick={onDelete}
      style={{
        aspectRatio: '3 / 4',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        background: 'var(--surface-2)',
        position: 'relative',
        padding: 0,
      }}
      aria-label={`Foto van ${day} verwijderen`}
      title={`${day} — tik om te verwijderen`}
    >
      {url && (
        <img
          src={url}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
    </button>
  );
}
