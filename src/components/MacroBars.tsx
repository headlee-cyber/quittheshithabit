import type { Macros } from '../types';

const ROWS: { key: keyof Macros; label: string; unit: string; cls: string }[] = [
  { key: 'kcal', label: 'カロリー', unit: 'kcal', cls: 'kcal' },
  { key: 'protein', label: 'P タンパク質', unit: 'g', cls: 'p' },
  { key: 'fat', label: 'F 脂質', unit: 'g', cls: 'f' },
  { key: 'carbs', label: 'C 炭水化物', unit: 'g', cls: 'c' },
];

export function MacroBars({ total, target }: { total: Macros; target: Macros }) {
  return (
    <div className="card stack">
      {ROWS.map((r) => {
        const t = target[r.key];
        const v = total[r.key];
        const pct = t > 0 ? (v / t) * 100 : 0;
        const rest = Math.round((t - v) * 10) / 10;
        return (
          <div key={r.key} className="bar-row">
            <div className="bar-head">
              <span>{r.label}</span>
              <span className="num">
                <strong>{v}</strong> / {t} {r.unit}
                <span className={`rest ${rest < 0 ? 'over' : ''}`}>
                  {rest >= 0 ? `残り ${rest}` : `+${-rest} 超過`}
                </span>
              </span>
            </div>
            <div className="bar">
              <div className={`fill ${r.cls} ${pct > 100 ? 'over' : ''}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
