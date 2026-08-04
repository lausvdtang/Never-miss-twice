import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/* ----------------------------------------------------------------- toast */

interface ToastMessage {
  id: number;
  text: string;
  accent: boolean;
}

const ToastContext = createContext<(text: string, accent?: boolean) => void>(
  () => {},
);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const nextId = useRef(0);

  const show = useCallback((text: string, accent = false) => {
    const id = nextId.current++;
    setMessages((m) => [...m, { id, text, accent }]);
    setTimeout(() => {
      setMessages((m) => m.filter((x) => x.id !== id));
    }, 2600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-layer" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`toast${m.accent ? ' accent' : ''}`}>
            {m.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ------------------------------------------------------------------ card */

export function Card({
  children,
  tone,
  className = '',
}: {
  children: ReactNode;
  tone?: 'flat' | 'accent' | 'attention' | 'calm';
  className?: string;
}) {
  return (
    <section className={`card${tone ? ` ${tone}` : ''} ${className}`.trim()}>
      {children}
    </section>
  );
}

/* --------------------------------------------------------------- stepper */

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = Infinity,
  unit,
  format,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  format?: (v: number) => string;
  label?: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100));
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(clamp(value - step))} aria-label="Minder">
        −
      </button>
      <div className="stepper-value">
        {format ? format(value) : value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      <button type="button" onClick={() => onChange(clamp(value + step))} aria-label="Meer">
        +
      </button>
    </div>
  );
}

/** Compacte variant voor set-regels: +/- direct naast de waarde. */
export function MiniStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  unit,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  unit?: string;
  ariaLabel: string;
}) {
  const clamp = (v: number) => Math.max(min, Math.round(v * 100) / 100);
  const display = Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace('.', ',');
  return (
    <div className="mini-step" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        aria-label={`${ariaLabel} minder`}
      >
        −
      </button>
      <div className="val">
        {display}
        {unit && <small> {unit}</small>}
      </div>
      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        aria-label={`${ariaLabel} meer`}
      >
        +
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ ring */

export function Ring({
  value,
  max,
  size = 92,
  stroke = 9,
  color = 'var(--accent)',
  label,
  unit,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  unit?: string;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const offset = circumference * (1 - pct);
  const over = max > 0 && value > max;

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? 'var(--free)' : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="ring-label">
        <span className="ring-value">{label}</span>
        {unit && <span className="ring-unit">{unit}</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- bar */

export function Bar({
  value,
  max,
  color = 'var(--accent)',
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="bar">
      <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function MacroRow({
  name,
  value,
  target,
  unit = 'g',
  color = 'var(--accent)',
}: {
  name: string;
  value: number;
  target: number;
  unit?: string;
  color?: string;
}) {
  return (
    <div className="macro-row">
      <span>{name}</span>
      <Bar value={value} max={target} color={color} />
      <span className="num">
        {Math.round(value)}/{Math.round(target)}
        {unit}
      </span>
    </div>
  );
}

/* ----------------------------------------------------------------- sheet */

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="sheet-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- check */

export function Check({ on }: { on: boolean }) {
  return <span className={`check${on ? ' on' : ''}`}>{on ? '✓' : ''}</span>;
}

/* --------------------------------------------------------------- segment */

export function Segment<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="segment" role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ streakbalk */

export function StreakStrip({
  days,
}: {
  days: {
    day: string;
    done: boolean;
    minimal: boolean;
    isToday: boolean;
    beforeStart?: boolean;
  }[];
}) {
  return (
    <div className="streak-strip" aria-label="Laatste dagen">
      {days.map((d) => (
        <span
          key={d.day}
          className={[
            'streak-dot',
            d.done ? (d.minimal ? 'minimal' : 'done') : '',
            d.isToday ? 'today' : '',
            d.beforeStart ? 'before' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          title={d.day}
        />
      ))}
    </div>
  );
}

/** "1 dag" / "3 dagen" — kleine dingen, maar ze vallen wél op. */
export function plural(count: number, singular: string, plural_: string): string {
  return `${count} ${count === 1 ? singular : plural_}`;
}

/* ---------------------------------------------------------------- diverse */

export function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: 'accent' | 'free' | 'attention' | 'calm';
}) {
  return <span className={`badge${tone ? ` ${tone}` : ''}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

/** Klein hulpmiddel om subtiele haptiek te geven zonder afhankelijkheid. */
export function tapFeedback(enabled: boolean) {
  if (!enabled) return;
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(12);
    } catch {
      /* geen haptiek beschikbaar — niet erg */
    }
  }
}

/** Houdt een waarde vast tot hij verandert; voor de "net afgevinkt"-animatie. */
export function usePulse(): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const trigger = useCallback(() => {
    setOn(true);
    setTimeout(() => setOn(false), 420);
  }, []);
  return [on, trigger];
}

export function useNow(intervalMs = 60000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function formatNumber(n: number, decimals = 0): string {
  return n.toFixed(decimals).replace('.', ',');
}

export function useMemoized<T>(fn: () => T, deps: unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(fn, deps);
}
