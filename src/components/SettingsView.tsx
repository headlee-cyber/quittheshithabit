import { useState, type FormEvent } from 'react';
import { bmr, calcTargets, DEFAULT_KCAL_ADJUST, tdee } from '../lib/nutrition';
import { supabase } from '../store/supabaseRepo';
import type { Goal, Profile } from '../types';

const ACTIVITY = [
  { v: 1.2, label: '1.2 ほぼ運動しない' },
  { v: 1.375, label: '1.375 週1〜3回の運動' },
  { v: 1.55, label: '1.55 週3〜5回の運動' },
  { v: 1.725, label: '1.725 週6〜7回の運動' },
  { v: 1.9, label: '1.9 非常に激しい運動・肉体労働' },
];
const GOALS: { v: Goal; label: string }[] = [
  { v: 'bulk', label: '増量' },
  { v: 'maintain', label: '維持' },
  { v: 'cut', label: '減量' },
];

const DEFAULT: Profile = {
  sex: 'male',
  age: 30,
  heightCm: 170,
  weightKg: 65,
  activity: 1.55,
  goal: 'bulk',
  kcalAdjust: DEFAULT_KCAL_ADJUST.bulk,
  proteinPerKg: 2,
  fatRatio: 0.25,
};

interface Props {
  profile: Profile | null;
  onSave: (p: Profile) => Promise<void>;
  repoKind: 'local' | 'supabase';
  email?: string;
}

export function SettingsView({ profile, onSave, repoKind, email }: Props) {
  const [p, setP] = useState<Profile>(profile ?? DEFAULT);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    setSaved(false);
    setP((prev) => ({ ...prev, [k]: v }));
  };

  const valid = p.age > 0 && p.heightCm > 0 && p.weightKg > 0;
  const t = valid ? calcTargets(p) : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await onSave(p);
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="stack">
      <h1>設定</h1>
      {error && <div className="error">{error}</div>}
      <form className="card stack" onSubmit={submit}>
        <h2>プロフィール</h2>
        <div className="seg">
          {(['male', 'female'] as const).map((s) => (
            <button type="button" key={s} className={p.sex === s ? 'on' : ''} onClick={() => set('sex', s)}>
              {s === 'male' ? '男性' : '女性'}
            </button>
          ))}
        </div>
        <div className="grid3">
          <label>
            年齢
            <input type="number" min="1" value={p.age || ''} onChange={(e) => set('age', Number(e.target.value))} />
          </label>
          <label>
            身長 (cm)
            <input type="number" min="1" step="0.1" value={p.heightCm || ''} onChange={(e) => set('heightCm', Number(e.target.value))} />
          </label>
          <label>
            体重 (kg)
            <input type="number" min="1" step="0.1" value={p.weightKg || ''} onChange={(e) => set('weightKg', Number(e.target.value))} />
          </label>
        </div>
        <label>
          活動レベル
          <select value={p.activity} onChange={(e) => set('activity', Number(e.target.value))}>
            {ACTIVITY.map((a) => (
              <option key={a.v} value={a.v}>
                {a.label}
              </option>
            ))}
          </select>
        </label>

        <h2>目的</h2>
        <div className="seg">
          {GOALS.map((g) => (
            <button
              type="button"
              key={g.v}
              className={p.goal === g.v ? 'on' : ''}
              onClick={() => {
                setSaved(false);
                setP((prev) => ({ ...prev, goal: g.v, kcalAdjust: DEFAULT_KCAL_ADJUST[g.v] }));
              }}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="grid3">
          <label>
            カロリー増減 (kcal)
            <input type="number" step="50" value={p.kcalAdjust} onChange={(e) => set('kcalAdjust', Number(e.target.value))} />
          </label>
          <label>
            P (g/体重kg)
            <input type="number" min="0" step="0.1" value={p.proteinPerKg} onChange={(e) => set('proteinPerKg', Number(e.target.value))} />
          </label>
          <label>
            脂質の割合 (%)
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={Math.round(p.fatRatio * 100)}
              onChange={(e) => set('fatRatio', Number(e.target.value) / 100)}
            />
          </label>
        </div>

        {t && (
          <div className="summary">
            <div className="muted small num">
              基礎代謝 {Math.round(bmr(p))} kcal × 活動係数 {p.activity} = 消費 {Math.round(tdee(p))} kcal
            </div>
            <div className="targets num">
              <div><span>目標</span><strong>{t.kcal}</strong>kcal</div>
              <div><span>P</span><strong>{t.protein}</strong>g</div>
              <div><span>F</span><strong>{t.fat}</strong>g</div>
              <div><span>C</span><strong>{t.carbs}</strong>g</div>
            </div>
            <p className="muted small">
              基礎代謝は Mifflin-St Jeor 式による推定値です。実際の体重変化を見ながら「カロリー増減」を調整してください。
            </p>
          </div>
        )}
        <button className="primary" disabled={!valid}>
          {saved ? '保存しました' : '保存'}
        </button>
      </form>

      <div className="card stack">
        <h2>データの保存先</h2>
        {repoKind === 'supabase' ? (
          <>
            <p>クラウド (Supabase) に同期しています。{email && <span className="muted"> {email}</span>}</p>
            <button onClick={() => supabase?.auth.signOut()}>ログアウト</button>
          </>
        ) : (
          <p className="muted">
            この端末のブラウザ内に保存しています。クラウド同期するには、.env.local に Supabase の接続情報を設定してください（README 参照）。
          </p>
        )}
      </div>
    </div>
  );
}
