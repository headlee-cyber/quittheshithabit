import { useMemo, useState, type FormEvent } from 'react';
import { kcalFromMacros, scaleFood, searchFoods } from '../lib/nutrition';
import { newId } from '../lib/date';
import { MEAL_LABELS, type Food, type MealEntry, type MealType } from '../types';

export function defaultMeal(): MealType {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

interface Props {
  date: string;
  foods: Food[];
  onAdd: (e: MealEntry) => Promise<void>;
}

export function AddMealForm({ date, foods, onAdd }: Props) {
  const [mode, setMode] = useState<'food' | 'manual'>('food');
  const [meal, setMeal] = useState<MealType>(defaultMeal);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Food | null>(null);
  const [grams, setGrams] = useState('');
  const [manual, setManual] = useState({ name: '', protein: '', fat: '', carbs: '', kcal: '' });
  const [busy, setBusy] = useState(false);

  const hits = useMemo(() => searchFoods(foods, query).slice(0, 8), [foods, query]);
  const g = Number(grams);
  const preview = selected && g > 0 ? scaleFood(selected, g) : null;

  const num = (s: string) => (s === '' ? 0 : Number(s));
  const manualKcalAuto = kcalFromMacros({ protein: num(manual.protein), fat: num(manual.fat), carbs: num(manual.carbs) });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    let entry: MealEntry;
    if (mode === 'food') {
      if (!selected || !preview) return;
      entry = { id: newId(), date, meal, name: selected.name, grams: g, ...preview };
    } else {
      if (!manual.name.trim()) return;
      entry = {
        id: newId(),
        date,
        meal,
        name: manual.name.trim(),
        grams: null,
        protein: num(manual.protein),
        fat: num(manual.fat),
        carbs: num(manual.carbs),
        kcal: manual.kcal === '' ? manualKcalAuto : num(manual.kcal),
      };
    }
    setBusy(true);
    try {
      await onAdd(entry);
      setSelected(null);
      setQuery('');
      setGrams('');
      setManual({ name: '', protein: '', fat: '', carbs: '', kcal: '' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <div className="row">
        <select value={meal} onChange={(e) => setMeal(e.target.value as MealType)} aria-label="食事区分">
          {Object.entries(MEAL_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <div className="seg">
          <button type="button" className={mode === 'food' ? 'on' : ''} onClick={() => setMode('food')}>
            食品から
          </button>
          <button type="button" className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}>
            手入力
          </button>
        </div>
      </div>

      {mode === 'food' ? (
        <>
          {selected ? (
            <div className="selected">
              <span>{selected.name}</span>
              <button type="button" className="link" onClick={() => setSelected(null)}>
                変更
              </button>
            </div>
          ) : (
            <>
              <input placeholder="食品を検索（例: 鶏むね）" value={query} onChange={(e) => setQuery(e.target.value)} />
              <ul className="hits">
                {hits.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(f);
                        setGrams(f.servingG ? String(f.servingG) : '100');
                      }}
                    >
                      <span>{f.name}</span>
                      <span className="muted small num">
                        100gあたり {f.kcal}kcal P{f.protein} F{f.fat} C{f.carbs}
                      </span>
                    </button>
                  </li>
                ))}
                {hits.length === 0 && <li className="muted small">見つかりません。「食品」タブで登録できます。</li>}
              </ul>
            </>
          )}
          {selected && (
            <label>
              量 (g)
              <input type="number" inputMode="decimal" min="0" step="any" value={grams} onChange={(e) => setGrams(e.target.value)} />
            </label>
          )}
          {preview && (
            <p className="muted num">
              {preview.kcal}kcal / P{preview.protein} F{preview.fat} C{preview.carbs}
            </p>
          )}
        </>
      ) : (
        <>
          <input placeholder="名前（例: コンビニのサラダチキン）" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
          <div className="grid4">
            {(['protein', 'fat', 'carbs'] as const).map((k) => (
              <label key={k}>
                {k === 'protein' ? 'P (g)' : k === 'fat' ? 'F (g)' : 'C (g)'}
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={manual[k]}
                  onChange={(e) => setManual({ ...manual, [k]: e.target.value })}
                />
              </label>
            ))}
            <label>
              kcal
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder={String(manualKcalAuto)}
                value={manual.kcal}
                onChange={(e) => setManual({ ...manual, kcal: e.target.value })}
              />
            </label>
          </div>
          <p className="muted small">kcal を空欄にすると P×4 + F×9 + C×4 で計算します。</p>
        </>
      )}

      <button className="primary" disabled={busy || (mode === 'food' ? !preview : !manual.name.trim())}>
        追加
      </button>
    </form>
  );
}
