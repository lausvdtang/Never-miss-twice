import { macroTargets } from './nutrition';
import type { AppState } from './types';

/** RFC 4180-achtige escaping: alles tussen quotes, quotes verdubbeld. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export interface CsvFile {
  name: string;
  content: string;
}

/** Eén bestand per entiteit — makkelijker in Excel/Sheets dan één brei. */
export function buildCsvFiles(state: AppState): CsvFile[] {
  const files: CsvFile[] = [];

  files.push({
    name: 'trainingen.csv',
    content: toCsv([
      ['datum', 'schema', 'status', 'gestart', 'afgerond', 'oefening', 'set', 'gewicht_kg', 'reps', 'gedaan'],
      ...state.sessions.flatMap((s) =>
        s.sets.length > 0
          ? s.sets.map((set) => [
              s.day,
              s.templateName,
              s.status,
              s.startedAt ?? '',
              s.finishedAt ?? '',
              set.exerciseName,
              set.setIndex + 1,
              set.weightKg,
              set.reps,
              set.done ? 'ja' : 'nee',
            ])
          : [[s.day, s.templateName, s.status, s.startedAt ?? '', s.finishedAt ?? '', '', '', '', '', '']],
      ),
    ]),
  });

  files.push({
    name: 'cardio.csv',
    content: toCsv([
      ['datum', 'type', 'minuten', 'afstand_km', 'notitie'],
      ...state.cardio.map((c) => [c.day, c.kind, c.minutes, c.distanceKm ?? '', c.note ?? '']),
    ]),
  });

  files.push({
    name: 'maaltijden.csv',
    content: toCsv([
      ['datum', 'naam', 'porties', 'kcal', 'eiwit_g', 'koolhydraten_g', 'vet_g', 'kwaliteit'],
      ...state.meals.map((m) => [
        m.day,
        m.name,
        m.servings,
        Math.round(m.kcal * m.servings),
        Math.round(m.proteinG * m.servings),
        Math.round(m.carbsG * m.servings),
        Math.round(m.fatG * m.servings),
        m.quality === 'basis' ? 'basis (80%)' : 'vrij (20%)',
      ]),
    ]),
  });

  files.push({
    name: 'alcohol.csv',
    content: toCsv([
      ['datum', 'naam', 'aantal', 'kcal_totaal', 'standaardglazen', 'uren_na_training'],
      ...state.alcohol.map((a) => [
        a.day,
        a.name,
        a.count,
        Math.round(a.kcal * a.count),
        (a.standardGlasses * a.count).toFixed(1),
        a.withinHoursOfTraining ?? '',
      ]),
    ]),
  });

  files.push({
    name: 'metingen.csv',
    content: toCsv([
      ['datum', 'gewicht_kg', 'vetpercentage', 'spiermassa_kg', 'notitie'],
      ...state.weighIns.map((w) => [
        w.day,
        w.weightKg,
        w.bodyFatPct ?? '',
        w.muscleMassKg ?? '',
        w.note ?? '',
      ]),
    ]),
  });

  files.push({
    name: 'gewoontes.csv',
    content: toCsv([
      ['datum', 'gewoonte', 'identiteit', 'type'],
      ...state.habitLogs.map((l) => {
        const habit = state.habits.find((h) => h.id === l.habitId);
        return [l.day, habit?.name ?? l.habitId, habit?.identity ?? '', l.completion];
      }),
    ]),
  });

  files.push({
    name: 'supplementen.csv',
    content: toCsv([
      ['datum', 'ingenomen'],
      ...state.supplementLogs.map((s) => [s.day, s.taken.join(' | ')]),
    ]),
  });

  files.push({
    name: 'stappen.csv',
    content: toCsv([['datum', 'stappen'], ...state.steps.map((s) => [s.day, s.steps])]),
  });

  files.push({
    name: 'weekcheckins.csv',
    content: toCsv([
      ['week', 'haalbare_dagen', 'energie', 'aanpassing', 'ingevuld'],
      ...state.checkIns.map((c) => [c.week, c.availableDays, c.energy, c.adjust, c.completedAt]),
    ]),
  });

  return files;
}

/** Eén tekstbestand met alle CSV-secties — makkelijkst te delen op mobiel. */
export function buildCombinedCsv(state: AppState): string {
  return buildCsvFiles(state)
    .map((f) => `# ${f.name}\r\n${f.content}`)
    .join('\r\n\r\n');
}

/**
 * Printbaar overzicht. De browser levert de PDF via het printdialoog, zodat we
 * geen PDF-bibliotheek nodig hebben en de data het apparaat niet verlaat.
 */
export function buildReportHtml(state: AppState): string {
  const t = macroTargets(state.profile);
  const weighIns = [...state.weighIns].sort((a, b) => a.day.localeCompare(b.day));
  const sessions = state.sessions.filter(
    (s) => s.status === 'voltooid' || s.status === 'minimaal',
  );
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8">
<title>Never Miss Twice — overzicht</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
       margin:32px;color:#1b2027;line-height:1.5}
  h1{font-size:22px;margin:0 0 4px} h2{font-size:15px;margin:24px 0 8px}
  table{border-collapse:collapse;width:100%;font-size:12px}
  th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #e3e8ee}
  th{color:#5d6875;font-weight:600}
  .meta{color:#5d6875;font-size:12px}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}
  .kpi{border:1px solid #e3e8ee;border-radius:10px;padding:10px}
  .kpi b{display:block;font-size:18px}
  @media print{body{margin:12mm}}
</style></head><body>
<h1>Never Miss Twice</h1>
<p class="meta">Overzicht gegenereerd op ${new Date().toLocaleDateString('nl-NL')}${
    state.profile.name ? ` — ${esc(state.profile.name)}` : ''
  }</p>
<div class="grid">
  <div class="kpi"><b>${sessions.length}</b><span class="meta">trainingen gelogd</span></div>
  <div class="kpi"><b>${t.kcal}</b><span class="meta">kcal doel/dag</span></div>
  <div class="kpi"><b>${t.proteinG} g</b><span class="meta">eiwit doel/dag</span></div>
  <div class="kpi"><b>${weighIns.length}</b><span class="meta">weegmomenten</span></div>
</div>

<h2>Metingen</h2>
<table><thead><tr><th>Datum</th><th>Gewicht</th><th>Vet%</th><th>Spiermassa</th></tr></thead><tbody>
${
  weighIns.length === 0
    ? '<tr><td colspan="4" class="meta">Nog geen metingen.</td></tr>'
    : weighIns
        .map(
          (w) =>
            `<tr><td>${w.day}</td><td>${w.weightKg} kg</td><td>${
              w.bodyFatPct ?? '—'
            }</td><td>${w.muscleMassKg ?? '—'}</td></tr>`,
        )
        .join('')
}
</tbody></table>

<h2>Trainingen</h2>
<table><thead><tr><th>Datum</th><th>Schema</th><th>Status</th><th>Sets</th></tr></thead><tbody>
${
  sessions.length === 0
    ? '<tr><td colspan="4" class="meta">Nog geen trainingen.</td></tr>'
    : sessions
        .sort((a, b) => b.day.localeCompare(a.day))
        .slice(0, 60)
        .map(
          (s) =>
            `<tr><td>${s.day}</td><td>${esc(s.templateName)}</td><td>${
              s.status === 'minimaal' ? 'minimale versie' : 'voltooid'
            }</td><td>${s.sets.filter((x) => x.done).length}</td></tr>`,
        )
        .join('')
}
</tbody></table>

<h2>Weekcheck-ins</h2>
<table><thead><tr><th>Week</th><th>Haalbare dagen</th><th>Energie</th><th>Aanpassing</th></tr></thead><tbody>
${
  state.checkIns.length === 0
    ? '<tr><td colspan="4" class="meta">Nog geen check-ins.</td></tr>'
    : state.checkIns
        .sort((a, b) => b.week.localeCompare(a.week))
        .map(
          (c) =>
            `<tr><td>${c.week}</td><td>${c.availableDays}</td><td>${c.energy}/5</td><td>${esc(
              c.adjust || '—',
            )}</td></tr>`,
        )
        .join('')
}
</tbody></table>
</body></html>`;
}

export function downloadText(filename: string, content: string, mime = 'text/csv') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openPrintableReport(state: AppState) {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(buildReportHtml(state));
  win.document.close();
  setTimeout(() => win.print(), 350);
  return true;
}

/** Volledige back-up als JSON — alles blijft lokaal, dit is de enige uitweg. */
export function exportBackup(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function parseBackup(json: string): AppState {
  const parsed = JSON.parse(json);
  if (typeof parsed !== 'object' || parsed === null || !('profile' in parsed)) {
    throw new Error('Dit bestand ziet er niet uit als een Never Miss Twice-back-up.');
  }
  return parsed as AppState;
}
