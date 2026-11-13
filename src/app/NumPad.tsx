import { type PadKey, pressKey } from './numpad.ts';

const ROWS: { key: PadKey; label: string }[][] = [
  [
    { key: '7', label: '7' },
    { key: '8', label: '8' },
    { key: '9', label: '9' },
    { key: 'back', label: '⌫' },
  ],
  [
    { key: '4', label: '4' },
    { key: '5', label: '5' },
    { key: '6', label: '6' },
    { key: '/', label: '분수 /' },
  ],
  [
    { key: '1', label: '1' },
    { key: '2', label: '2' },
    { key: '3', label: '3' },
    { key: '.', label: '.' },
  ],
  [
    { key: '-', label: '−' },
    { key: '0', label: '0' },
    { key: 'clear', label: '모두 지움' },
  ],
];

export function NumPad({ value, onChange }: { value: string; onChange(v: string): void }) {
  return (
    <div className="numpad">
      {ROWS.map((row) => (
        <div className="numpad-row" key={row.map((k) => k.key).join()}>
          {row.map((k) => (
            <button
              type="button"
              key={k.key}
              className={`btn pad-${k.key === 'clear' ? 'wide' : 'key'}`}
              onClick={() => onChange(pressKey(value, k.key))}
            >
              {k.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
