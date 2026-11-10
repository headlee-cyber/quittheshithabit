import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatJa, today } from '../lib/date';
import { rollingAverageByDays } from '../lib/nutrition';
import type { Repo } from '../store/repo';
import type { Profile, WeightEntry } from '../types';

interface Props {
  repo: Repo;
  profile: Profile | null;
  onProfileChange: (p: Profile) => Promise<void>;
}

export function WeightView({ repo, profile, onProfileChange }: Props) {
  const [list, setList] = useState<WeightEntry[]>([]);
  const [date, setDate] = useState(today);
  const [kg, setKg] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    repo.listWeights().then(setList, (e: Error) => setError(e.message));
  }, [repo]);
  useEffect(reload, [reload]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = Number(kg);
    if (!(v > 0)) return;
    try {
      await repo.upsertWeight({ date, kg: v });
      // 最新日付の記録なら、目標計算に使う体重も更新する
      const latest = list.reduce((a, b) => (b.date > a ? b.date : a), '');
      if (profile && date >= latest && profile.weightKg !== v) await onProfileChange({ ...profile, weightKg: v });
      setKg('');
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async (d: string) => {
    if (!confirm(`${formatJa(d)} の記録を削除しますか？`)) return;
    await repo.deleteWeight(d).catch((e: Error) => setError(e.message));
    reload();
  };

  const ma = rollingAverageByDays(list, 7);
  const data = list.map((w, i) => ({ t: Date.parse(w.date + 'T00:00:00'), kg: w.kg, ma: ma[i] }));
  const tickLabel = (t: number) => {
    const d = new Date(t);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  const kgs = list.map((w) => w.kg);
  const domain: [number, number] = kgs.length
    ? [Math.floor(Math.min(...kgs) - 1), Math.ceil(Math.max(...kgs) + 1)]
    : [0, 100];

  return (
    <div className="stack">
      <h1>体重</h1>
      {error && <div className="error">{error}</div>}
      <form className="card row" onSubmit={submit}>
        <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} aria-label="日付" />
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          placeholder="kg"
          value={kg}
          onChange={(e) => setKg(e.target.value)}
          aria-label="体重 (kg)"
        />
        <button className="primary">記録</button>
      </form>
      <p className="muted small">最新日付の体重を記録すると、目標値の計算に使う体重も自動で更新されます。</p>

      {list.length >= 2 ? (
        <div className="card chart">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={tickLabel}
                tick={{ fontSize: 11, fill: 'var(--muted)' }}
                minTickGap={24}
              />
              <YAxis domain={domain} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
              <Tooltip
                labelFormatter={(t) => tickLabel(Number(t))}
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line name="体重" dataKey="kg" stroke="var(--accent)" dot={{ r: 2 }} strokeWidth={2} isAnimationActive={false} />
              <Line name="7日平均" dataKey="ma" stroke="var(--c-f)" dot={false} strokeWidth={2} connectNulls isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="muted">2日分以上記録するとグラフが表示されます。</p>
      )}

      {list.length > 0 && (
        <ul className="card entries">
          {[...list].reverse().map((w) => (
            <li key={w.date}>
              <span>{formatJa(w.date)}</span>
              <span className="num">{w.kg} kg</span>
              <button className="icon" onClick={() => remove(w.date)} aria-label="削除">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
