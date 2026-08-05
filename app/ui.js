import { classNames, clear, el, svg } from './dom.js';
import { nl } from './date.js';

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

function drawSheet() {
  const host = ensureSheetHost();
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
  const clamp = (v) => Math.min(max, Math.max(min, Math.round(v * 100) / 100));
  return el(
    'div',
    { class: 'stepper', role: 'group', 'aria-label': label },
    el(
      'button',
      { type: 'button', 'aria-label': 'Minder', onclick: () => onChange(clamp(value - step)) },
      '−',
    ),
    el(
      'div',
      { class: 'stepper-value' },
      format ? format(value) : String(value),
      unit ? el('span', { class: 'unit' }, unit) : null,
    ),
    el(
      'button',
      { type: 'button', 'aria-label': 'Meer', onclick: () => onChange(clamp(value + step)) },
      '+',
    ),
  );
}

/** Compacte variant voor set-regels: +/- direct naast de waarde. */
export function miniStepper({ value, onChange, step = 1, min = 0, unit, ariaLabel }) {
  const clamp = (v) => Math.max(min, Math.round(v * 100) / 100);
  const display = Number.isInteger(value) ? String(value) : nl(value);
  return el(
    'div',
    { class: 'mini-step', role: 'group', 'aria-label': ariaLabel },
    el(
      'button',
      {
        type: 'button',
        'aria-label': `${ariaLabel} minder`,
        onclick: () => onChange(clamp(value - step)),
      },
      '−',
    ),
    el('div', { class: 'val' }, display, unit ? el('small', {}, ` ${unit}`) : null),
    el(
      'button',
      {
        type: 'button',
        'aria-label': `${ariaLabel} meer`,
        onclick: () => onChange(clamp(value + step)),
      },
      '+',
    ),
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
