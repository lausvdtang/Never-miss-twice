import { useMemo, useState } from 'react';
import { Badge, Card, Sheet, Stepper, tapFeedback, useToast } from '../../components/ui';
import { newId, nowISO, useAppState, useUpdate } from '../../lib/store';
import type { DayKey, FoodPreset, FoodQuality } from '../../lib/types';

/**
 * Eten loggen in maximaal drie taps: openen → product → toevoegen.
 * Favorieten en noodmaaltijden staan bovenaan, want die zijn het vaakst nodig.
 */
export function QuickFoodSheet({
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

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<FoodPreset | null>(null);
  const [servings, setServings] = useState(1);
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    kcal: 400,
    proteinG: 30,
    carbsG: 40,
    fatG: 12,
    quality: 'basis' as FoodQuality,
  });

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = state.foodPresets;
    if (!q) {
      return [...list].sort((a, b) => {
        const score = (f: FoodPreset) =>
          (f.favorite ? 0 : 1) + (f.emergency ? -0.5 : 0);
        return score(a) - score(b) || a.name.localeCompare(b.name);
      });
    }
    return list.filter((f) => f.name.toLowerCase().includes(q));
  }, [query, state.foodPresets]);

  function reset() {
    setSelected(null);
    setServings(1);
    setQuery('');
    setCustom(false);
  }

  function addPreset(preset: FoodPreset, count: number) {
    update((s) => {
      s.meals = [
        ...s.meals,
        {
          id: newId('meal'),
          day,
          name: preset.name,
          kcal: preset.kcal,
          proteinG: preset.proteinG,
          carbsG: preset.carbsG,
          fatG: preset.fatG,
          quality: preset.quality,
          servings: count,
          presetId: preset.id,
          loggedAt: nowISO(),
        },
      ];
    });
    tapFeedback(state.settings.celebrate);
    toast(`${preset.name} toegevoegd`, true);
    reset();
    onClose();
  }

  function addCustom() {
    if (!draft.name.trim()) return;
    update((s) => {
      s.meals = [
        ...s.meals,
        {
          id: newId('meal'),
          day,
          name: draft.name.trim(),
          kcal: draft.kcal,
          proteinG: draft.proteinG,
          carbsG: draft.carbsG,
          fatG: draft.fatG,
          quality: draft.quality,
          servings: 1,
          loggedAt: nowISO(),
        },
      ];
      // Meteen bewaren als preset, zodat het de volgende keer één tap is.
      s.foodPresets = [
        ...s.foodPresets,
        {
          id: newId('fp'),
          name: draft.name.trim(),
          portion: '1 portie',
          kcal: draft.kcal,
          proteinG: draft.proteinG,
          carbsG: draft.carbsG,
          fatG: draft.fatG,
          quality: draft.quality,
        },
      ];
    });
    tapFeedback(state.settings.celebrate);
    toast(`${draft.name} toegevoegd en bewaard`, true);
    setDraft({ ...draft, name: '' });
    reset();
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={selected ? selected.name : custom ? 'Zelf invullen' : 'Wat heb je gegeten?'}
    >
      {/* Stap 2: portie kiezen. Standaard 1 — direct toevoegen kan altijd. */}
      {selected ? (
        <>
          <Card tone="flat">
            <div className="row-between">
              <div>
                <h3>{selected.name}</h3>
                <p className="faint">{selected.portion}</p>
              </div>
              <Badge tone={selected.quality === 'basis' ? 'accent' : 'free'}>
                {selected.quality === 'basis' ? '80%' : '20%'}
              </Badge>
            </div>
            <div className="row-between">
              <span className="muted">Aantal porties</span>
              <Stepper
                value={servings}
                onChange={setServings}
                step={0.5}
                min={0.5}
                max={10}
                format={(v) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','))}
                label="Porties"
              />
            </div>
            <div className="divider" />
            <div className="row-between faint">
              <span>{Math.round(selected.kcal * servings)} kcal</span>
              <span>{Math.round(selected.proteinG * servings)} g eiwit</span>
              <span>{Math.round(selected.carbsG * servings)} g kh</span>
              <span>{Math.round(selected.fatG * servings)} g vet</span>
            </div>
          </Card>
          <button
            className="btn primary lg block"
            onClick={() => addPreset(selected, servings)}
          >
            Toevoegen
          </button>
          <button className="btn quiet block" onClick={() => setSelected(null)}>
            Ander product
          </button>
        </>
      ) : custom ? (
        <>
          <div className="field">
            <label htmlFor="food-name">Naam</label>
            <input
              id="food-name"
              className="input"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Bijv. broodje van de kantine"
              autoFocus
            />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Kcal</label>
              <Stepper
                value={draft.kcal}
                onChange={(v) => setDraft({ ...draft, kcal: v })}
                step={25}
                max={3000}
                label="Kcal"
              />
            </div>
            <div className="field">
              <label>Eiwit (g)</label>
              <Stepper
                value={draft.proteinG}
                onChange={(v) => setDraft({ ...draft, proteinG: v })}
                step={5}
                max={200}
                label="Eiwit"
              />
            </div>
            <div className="field">
              <label>Koolhydraten (g)</label>
              <Stepper
                value={draft.carbsG}
                onChange={(v) => setDraft({ ...draft, carbsG: v })}
                step={5}
                max={400}
                label="Koolhydraten"
              />
            </div>
            <div className="field">
              <label>Vet (g)</label>
              <Stepper
                value={draft.fatG}
                onChange={(v) => setDraft({ ...draft, fatG: v })}
                step={5}
                max={200}
                label="Vet"
              />
            </div>
          </div>
          <div className="field">
            <label>Telt mee als</label>
            <div className="row">
              <button
                className={`chip${draft.quality === 'basis' ? ' on' : ''}`}
                onClick={() => setDraft({ ...draft, quality: 'basis' })}
              >
                Basis (de 80%)
              </button>
              <button
                className={`chip free${draft.quality === 'vrij' ? ' on' : ''}`}
                onClick={() => setDraft({ ...draft, quality: 'vrij' })}
              >
                Vrij (de 20%)
              </button>
            </div>
          </div>
          <button
            className="btn primary lg block"
            onClick={addCustom}
            disabled={!draft.name.trim()}
          >
            Toevoegen en bewaren
          </button>
          <button className="btn quiet block" onClick={() => setCustom(false)}>
            Terug naar de lijst
          </button>
        </>
      ) : (
        <>
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoeken…"
            aria-label="Zoek een product"
          />
          <div className="list">
            {results.slice(0, 40).map((f) => (
              <button
                key={f.id}
                className="list-item"
                onClick={() => {
                  // Eén tap voor de standaardportie; lang niet altijd hoeft er
                  // een portie-scherm tussen.
                  setSelected(f);
                  setServings(1);
                }}
              >
                <span className="grow">
                  <span style={{ display: 'block', fontWeight: 600 }}>
                    {f.emergency ? '🆘 ' : ''}
                    {f.name}
                  </span>
                  <span className="faint">
                    {f.portion} · {f.kcal} kcal · {f.proteinG} g eiwit
                  </span>
                </span>
                {f.quality === 'vrij' && <Badge tone="free">20%</Badge>}
              </button>
            ))}
            {results.length === 0 && (
              <p className="empty">
                Niets gevonden. Vul het zelf even in — daarna staat het in je lijst.
              </p>
            )}
          </div>
          <button className="btn ghost block" onClick={() => setCustom(true)}>
            Zelf invullen
          </button>
        </>
      )}
    </Sheet>
  );
}
