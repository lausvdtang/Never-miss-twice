/**
 * Minimale DOM-laag.
 *
 * Genoeg om de hele app mee te bouwen, klein genoeg om zonder buildstap te
 * draaien. Schermen zijn gewone functies die een element teruggeven; bij een
 * wijziging in de store wordt het scherm opnieuw opgebouwd.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

function applyProps(node, props, namespace) {
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;

    if (key === 'class') {
      // Accepteert 'a b', ['a', 'b'] of { a: true, b: false }.
      node.setAttribute('class', classNames(value));
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(node.style, value);
    } else if (key === 'dataset') {
      Object.assign(node.dataset, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'disabled' || key === 'checked' || key === 'selected') {
      if (value) node.setAttribute(key, '');
      node[key] = !!value;
    } else if (key === 'value') {
      node.value = value;
    } else if (namespace) {
      node.setAttribute(key, String(value));
    } else {
      node.setAttribute(key, String(value));
    }
  }
}

function appendChildren(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === true) {
      continue;
    }
    node.appendChild(
      child instanceof Node ? child : document.createTextNode(String(child)),
    );
  }
}

export function classNames(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter(Boolean).join(' ');
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([, on]) => on)
      .map(([name]) => name)
      .join(' ');
  }
  return '';
}

/** `el('div', { class: 'card' }, 'tekst', el('p', {}, '…'))` */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  applyProps(node, props || {}, false);
  appendChildren(node, children);
  return node;
}

/** Zelfde idee, maar in de SVG-namespace — nodig voor de ring en de grafiek. */
export function svg(tag, props = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  applyProps(node, props || {}, true);
  appendChildren(node, children);
  return node;
}

export function frag(...children) {
  const f = document.createDocumentFragment();
  appendChildren(f, children);
  return f;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/**
 * Vervangt de inhoud van `container` door wat `render()` teruggeeft.
 *
 * De scrollpositie blijft staan: wie in de sportschool een set afvinkt die
 * halverwege de lijst staat, wil niet terug naar de bovenkant van het scherm.
 */
export function replaceContent(container, node, { keepScroll = true } = {}) {
  const y = keepScroll ? window.scrollY : 0;
  clear(container);
  container.appendChild(node);
  if (keepScroll && y > 0) {
    // Na de layoutronde terugzetten, anders is de pagina nog te kort.
    requestAnimationFrame(() => window.scrollTo(0, y));
  }
}

/** Kleine helper voor voorwaardelijke onderdelen: `when(cond, () => el(…))`. */
export function when(condition, build) {
  return condition ? build() : null;
}
