import { classNames, clear, createScheduler, el, preserveFocus, svg } from './dom.js';
import { DAY_NAMES, dayKey, isoWeekday, nl, parseDay } from './date.js';

/* ----------------------------------------------------------------- toast */

let toastLayer = null;

function ensureToastLayer() {
  if (!toastLayer) {
    toastLayer = el('div', { class: 'toast-layer', 'aria-live': 'polite' });
    document.body.appendChild(toastLayer);
  }
  return toastLayer;
}

export function toast(text, accent = false) {
  const layer = ensureToastLayer();
  const node = el('div', { class: classNames(['toast', accent && 'accent']) }, text);
  layer.appendChild(node);
  setTimeout(() => node.remove(), 2600);
}

/* ----------------------------------------------------------------- sheet */

let sheetHost = null;
let activeSheet = null;

function ensureSheetHost() {
  if (!sheetHost) {
    sheetHost = el('div');
    document.body.appendChild(sheetHost);
  }
  return sheetHost;
}

// Zelfde verhaal als bij het hoofdscherm: het leegmaken blurt een veld, de
// blur legt de waarde vast, en dat zou hier middenin een nieuwe tekenbeurt
// starten.
const drawSheet = createScheduler(() => {
  const host = ensureSheetHost();
  // Focus vasthouden: een venster hertekent bij elke stap, en dan wil je niet
  // uit het veld geduwd worden waar je in staat te typen.
  preserveFocus(host, () => drawSheetInner(host));
});

function drawSheetInner(host) {
  clear(host);

  if (!activeSheet) {
    document.body.style.overflow = '';
    return;
  }

  document.body.style.overflow = 'hidden';
  const content = activeSheet.render();
  // De titel mag een getter of functie zijn: sommige vensters wisselen van
  // kop zodra je een product kiest.
  const title =
    typeof activeSheet.title === 'function' ? activeSheet.title() : activeSheet.title;

  const panel = el(
    'div',
    { class: 'sheet', onclick: (e) => e.stopPropagation() },
    el('div', { class: 'sheet-grip' }),
    title ? el('h2', {}, title) : null,
    content,
  );

  host.appendChild(
    el(
      'div',
      {
        class: 'sheet-backdrop',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': title || 'Venster',
        onclick: closeSheet,
      },
      panel,
    ),
  );
}

/**
 * Opent een bodemvenster. `render` wordt telkens opnieuw aangeroepen als het
 * venster ververst moet worden, zodat lokale keuzes (porties, aantallen)
 * meteen zichtbaar zijn zonder de rest van het scherm opnieuw op te bouwen.
 *
 * Het hele optie-object wordt bewaard, zodat een `get title()` blijft werken.
 */
export function openSheet(options) {
  activeSheet = options;
  drawSheet();
}

export function closeSheet() {
  activeSheet = null;
  drawSheet();
}

/** Herteken alleen het open venster. */
export function refreshSheet() {
  if (activeSheet) drawSheet();
}

export function isSheetOpen() {
  return activeSheet !== null;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && activeSheet) closeSheet();
});

/* ------------------------------------------------------------------ card */

export function card(tone, ...children) {
  return el('section', { class: classNames(['card', tone]) }, ...children);
}

export function cardTitle(...children) {
  return el('div', { class: 'card-title' }, ...children);
}

/* --------------------------------------------------------------- stepper */

/**
 * Ingedrukt houden blijft ophogen, steeds sneller.
 *
 * Zonder dit kost 80 kg invoeren vanaf nul 32 losse tikken. De vertraging van
 * 420 ms zorgt dat een gewone tik nooit per ongeluk doorloopt.
 *
 * Tijdens het vasthouden schrijven we bewust níét naar de store: elke
 * schrijfactie bouwt het scherm opnieuw op, waardoor deze knop verdwijnt
 * terwijl de timer doorloopt — dan blijft de teller eindeloos doortellen.
 * We tonen de tussenstand rechtstreeks in het DOM en leggen pas bij loslaten
 * één keer vast.
 */
function attachHoldRepeat(node, { preview, commit }) {
  let timer = null;
  let held = false;

  const stop = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (held) {
      commit();
      // De klik die na het loslaten volgt hoort niet nóg een stap te zetten.
      node.dataset.heldRelease = '1';
      held = false;
    }
  };

  node.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    let delay = 300;
    const tick = () => {
      held = true;
      preview();
      delay = Math.max(55, delay * 0.75);
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, 420);
  });

  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) {
    node.addEventListener(ev, stop);
  }
}

/** Klik negeren als hij het staartje van een vasthoudactie is. */
function consumedByHold(node) {
  if (node.dataset.heldRelease) {
    delete node.dataset.heldRelease;
    return true;
  }
  return false;
}

/**
 * Getalveld waar je gewoon in kunt typen.
 *
 * Bewust een echt invoerveld en geen knop die er pas eentje wórdt: één tik en
 * je toetsenbord staat open. De +/- knoppen blijven ernaast staan voor kleine
 * bijstellingen.
 */
export function editableNumber({ value, onChange, format, unit, ariaLabel, className = 'val' }) {
  let current = value;
  const label = () =>
    format ? format(current) : Number.isInteger(current) ? String(current) : nl(current);

  const node = el('input', {
    type: 'text',
    // Levert op mobiel een cijfertoetsenbord met komma.
    inputmode: 'decimal',
    enterkeyhint: 'done',
    class: `${className} num-input`,
    value: label(),
    'aria-label': ariaLabel,
    // Sleutel waarop de focus teruggezet wordt na een hertekening.
    'data-focus-key': ariaLabel,
  });

  if (unit) node.setAttribute('data-unit', unit);

  /** Toont een waarde zonder hem vast te leggen (voor ingedrukt houden). */
  node.preview = (v) => {
    current = v;
    node.value = label();
  };

  /*
   * Typen vervangt de waarde; je hoeft de oude niet eerst weg te halen.
   *
   * Bewust alleen hier en niet ook nog een ronde later: een uitgestelde
   * selectie kan afgaan terwijl er al getypt wordt, en gooit dan de eerste
   * ingetikte cijfers weg. Tikken op een veld dat de focus al heeft, zet
   * gewoon de cursor neer — precies wat je wilt als je één cijfer bijwerkt.
   */
  node.addEventListener('focus', () => node.select());

  const commit = () => {
    const parsed = parseFloat(node.value.replace(',', '.'));
    if (!Number.isNaN(parsed) && parsed !== current) {
      current = parsed;
      onChange(parsed);
    } else {
      // Leeg of onveranderd: netjes terugzetten, zonder schrijfactie.
      node.value = label();
    }
  };

  node.addEventListener('blur', commit);
  node.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') node.blur();
    if (e.key === 'Escape') {
      node.value = label();
      node.blur();
    }
  });

  return node;
}

export function stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = Infinity,
  unit,
  format,
  label,
}) {
  return buildStepper({
    value,
    onChange,
    step,
    clamp: (v) => Math.min(max, Math.max(min, Math.round(v * 100) / 100)),
    ariaLabel: label,
    wrapperClass: 'stepper',
    valueNode: (node) =>
      el('div', { class: 'stepper-value' }, node, unit ? el('span', { class: 'unit' }, unit) : null),
    numberOptions: { format, className: 'stepper-num' },
  });
}

/** Compacte variant voor set-regels: +/- direct naast de waarde. */
export function miniStepper({ value, onChange, step = 1, min = 0, unit, ariaLabel }) {
  return buildStepper({
    value,
    onChange,
    step,
    clamp: (v) => Math.max(min, Math.round(v * 100) / 100),
    ariaLabel,
    wrapperClass: 'mini-step',
    // De eenheid staat naast het veld, niet erin: anders moet je hem bij het
    // typen steeds wegpoetsen.
    valueNode: (node) =>
      el('span', { class: 'val-wrap' }, node, unit ? el('small', {}, unit) : null),
    numberOptions: {},
  });
}

/** Gedeelde opbouw: tikken zet één stap, vasthouden loopt door. */
function buildStepper({
  value,
  onChange,
  step,
  clamp,
  ariaLabel,
  wrapperClass,
  valueNode,
  numberOptions,
}) {
  // Eén bron van waarheid tijdens de interactie; de store volgt bij het
  // vastleggen.
  let current = value;

  const number = editableNumber({
    value,
    onChange: (v) => onChange(clamp(v)),
    ariaLabel,
    ...numberOptions,
  });

  const makeButton = (label, delta) => {
    const btn = el(
      'button',
      {
        type: 'button',
        'aria-label': `${ariaLabel} ${label}`,
        // Buiten de tabvolgorde: zo springt Tab van veld naar veld in plaats
        // van via twee knoppen per getal. Met het toetsenbord typ je de
        // waarde toch rechtstreeks — die weg is niet alleen sneller maar ook
        // ruimer, dus er gaat geen functie verloren.
        tabindex: '-1',
      },
      delta < 0 ? '−' : '+',
    );

    btn.addEventListener('click', () => {
      if (consumedByHold(btn)) return;
      current = clamp(current + delta);
      onChange(current);
    });

    attachHoldRepeat(btn, {
      preview: () => {
        current = clamp(current + delta);
        number.preview(current);
      },
      commit: () => onChange(current),
    });

    return btn;
  };

  // Geen aria-label op de wikkel: het invoerveld draagt het label al, en
  // twee keer hetzelfde laten voorlezen helpt niemand.
  return el(
    'div',
    { class: wrapperClass },
    makeButton('minder', -step),
    valueNode(number),
    makeButton('meer', step),
  );
}

/* ------------------------------------------------------------------ ring */

export function ring({ value, max, size = 92, stroke = 9, color = 'var(--accent)', label, unit }) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const over = max > 0 && value > max;

  return el(
    'div',
    { class: 'ring', style: { width: `${size}px`, height: `${size}px` } },
    svg(
      'svg',
      { width: size, height: size, 'aria-hidden': 'true' },
      svg('circle', {
        cx: size / 2,
        cy: size / 2,
        r,
        fill: 'none',
        stroke: 'var(--surface-3)',
        'stroke-width': stroke,
      }),
      svg('circle', {
        cx: size / 2,
        cy: size / 2,
        r,
        fill: 'none',
        stroke: over ? 'var(--free)' : color,
        'stroke-width': stroke,
        'stroke-linecap': 'round',
        'stroke-dasharray': circumference,
        'stroke-dashoffset': circumference * (1 - pct),
      }),
    ),
    el(
      'div',
      { class: 'ring-label' },
      el('span', { class: 'ring-value' }, label),
      unit ? el('span', { class: 'ring-unit' }, unit) : null,
    ),
  );
}

/* ------------------------------------------------------------------- bar */

export function bar({ value, max, color = 'var(--accent)', tall = false }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return el(
    'div',
    { class: classNames(['bar', tall && 'tall']) },
    el('div', { class: 'bar-fill', style: { width: `${pct}%`, background: color } }),
  );
}

/** Tweekleurige balk voor de 80/20-verdeling. */
export function splitBar(basePct, freePct) {
  return el(
    'div',
    { class: 'bar tall' },
    el('div', { class: 'bar-fill', style: { width: `${basePct}%`, background: 'var(--accent)' } }),
    el('div', { class: 'bar-fill', style: { width: `${freePct}%`, background: 'var(--free)' } }),
  );
}

export function macroRow({ name, value, target, unit = 'g', color = 'var(--accent)' }) {
  return el(
    'div',
    { class: 'macro-row' },
    el('span', {}, name),
    bar({ value, max: target, color }),
    el('span', { class: 'num' }, `${Math.round(value)}/${Math.round(target)}${unit}`),
  );
}

/* ----------------------------------------------------------------- check */

export function check(on) {
  return el('span', { class: classNames(['check', on && 'on']) }, on ? '✓' : '');
}

/* --------------------------------------------------------------- segment */

export function segment({ value, options, onChange, ariaLabel }) {
  return el(
    'div',
    { class: 'segment', role: 'tablist', 'aria-label': ariaLabel },
    ...options.map((o) =>
      el(
        'button',
        {
          type: 'button',
          role: 'tab',
          'aria-selected': String(o.value === value),
          class: o.value === value ? 'on' : '',
          onclick: () => onChange(o.value),
        },
        o.label,
      ),
    ),
  );
}

/* ------------------------------------------------------------ streakbalk */

export function streakStrip(days) {
  return el(
    'div',
    { class: 'streak-strip', 'aria-label': 'Laatste dagen' },
    ...days.map((d) =>
      el('span', {
        class: classNames([
          'streak-dot',
          d.done && (d.minimal ? 'minimal' : 'done'),
          d.isToday && 'today',
          d.beforeStart && 'before',
        ]),
        title: d.day,
      }),
    ),
  );
}

/* -------------------------------------------------------------- grafieken */

/**
 * Kleine lijngrafiek zonder assen — bedoeld om in één oogopslag te zien of de
 * lijn omhoog loopt, niet om exacte waarden af te lezen.
 */
export function sparkline(values, { width = 132, height = 34, color = 'var(--accent)' } = {}) {
  if (values.length < 2) {
    return el('p', { class: 'faint' }, 'Nog te weinig sessies voor een lijn.');
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 4;

  const x = (i) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v) => pad + (1 - (v - min) / span) * (height - pad * 2);

  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const last = values[values.length - 1];

  return svg(
    'svg',
    {
      class: 'sparkline',
      viewBox: `0 0 ${width} ${height}`,
      preserveAspectRatio: 'none',
      role: 'img',
      'aria-label': `Verloop, laatste waarde ${nl(last)}`,
    },
    svg('path', {
      d: path,
      fill: 'none',
      stroke: color,
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
    svg('circle', { cx: x(values.length - 1), cy: y(last), r: 2.8, fill: color }),
  );
}

/**
 * Grotere staafgrafiek voor het volume per sessie van één schema.
 * Staven in plaats van een lijn: sessies zijn losse momenten, geen continu
 * verloop, en een staaf leest sneller af of er meer of minder is gedaan.
 */
export function barChart(items, { height = 120, color = 'var(--accent)', formatValue } = {}) {
  if (items.length === 0) {
    return el('p', { class: 'empty' }, 'Nog geen sessies om te vergelijken.');
  }

  const max = Math.max(...items.map((i) => i.value)) || 1;

  return el(
    'div',
    { class: 'bar-chart', style: { height: `${height}px` }, role: 'img', 'aria-label': 'Volume per sessie' },
    ...items.map((item) =>
      el(
        'div',
        { class: 'bar-col', title: `${item.label}: ${formatValue ? formatValue(item.value) : item.value}` },
        el('div', {
          class: classNames(['bar-col-fill', item.highlight && 'now']),
          style: {
            height: `${Math.max(3, (item.value / max) * 100)}%`,
            background: item.highlight ? 'var(--accent)' : color,
          },
        }),
        el('span', { class: 'bar-col-label' }, item.label),
      ),
    ),
  );
}

/* ---------------------------------------------------------------- agenda */

/**
 * Maandkalender voor het beginscherm.
 *
 * Groen = die dag als gezond gemarkeerd. Een stipje = die dag getraind.
 * Elke dag is aantikbaar, ook een dag terug: vergeten invullen hoort erbij en
 * mag geen reden zijn om het maar helemaal te laten.
 */
export function calendar({ monthAnchor, marks, onToggle, today, onPrev, onNext, monthLabel }) {
  const d = parseDay(monthAnchor);
  const year = d.getFullYear();
  const month = d.getMonth();

  const firstKey = dayKey(new Date(year, month, 1));
  const lead = isoWeekday(firstKey) - 1; // 0 = maandag
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(dayKey(new Date(year, month, i)));

  return el(
    'div',
    { class: 'calendar' },
    el(
      'div',
      { class: 'calendar-head' },
      el('button', { class: 'btn quiet sm', 'aria-label': 'Vorige maand', onclick: onPrev }, '‹'),
      el('span', { class: 'calendar-month' }, monthLabel),
      el('button', { class: 'btn quiet sm', 'aria-label': 'Volgende maand', onclick: onNext }, '›'),
    ),
    el(
      'div',
      { class: 'calendar-grid' },
      ...DAY_NAMES.map((n) => el('span', { class: 'calendar-dow' }, n)),
      ...cells.map((key) => {
        if (!key) return el('span', { class: 'calendar-cell empty-cell' });
        const mark = marks.get(key) ?? {};
        const future = key > today;
        return el(
          'button',
          {
            class: classNames([
              'calendar-cell',
              mark.healthy && 'healthy',
              key === today && 'is-today',
              future && 'future',
            ]),
            disabled: future,
            'aria-label': `${key}${mark.healthy ? ', gezond gegeten' : ''}${mark.trained ? ', getraind' : ''}`,
            'aria-pressed': mark.healthy ? 'true' : 'false',
            onclick: () => onToggle(key),
          },
          String(parseDay(key).getDate()),
          mark.trained ? el('span', { class: 'calendar-dot' }) : null,
        );
      }),
    ),
  );
}

/* ---------------------------------------------------------------- diverse */

export function badge(content, tone) {
  return el('span', { class: classNames(['badge', tone]) }, content);
}

export function empty(text) {
  return el('p', { class: 'empty' }, text);
}

export function field(label, ...children) {
  return el('div', { class: 'field' }, el('label', {}, label), ...children);
}

export function chip(label, { on = false, outline = false, narrow = false, free = false, onclick, title }) {
  return el(
    'button',
    {
      type: 'button',
      class: classNames(['chip', on && 'on', outline && 'outline', narrow && 'narrow', free && 'free']),
      onclick,
      title,
    },
    label,
  );
}

export function button(label, { variant = '', onclick, disabled = false, sub, ariaLabel, type = 'button' } = {}) {
  return el(
    'button',
    {
      type,
      class: classNames(['btn', variant]),
      onclick,
      disabled,
      'aria-label': ariaLabel,
    },
    label,
    sub ? el('span', { class: 'btn-sub' }, sub) : null,
  );
}

/** Subtiele haptiek zonder afhankelijkheid; stil falen als het niet kan. */
export function tapFeedback(enabled) {
  if (!enabled) return;
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(12);
    } catch {
      /* geen haptiek beschikbaar — niet erg */
    }
  }
}
