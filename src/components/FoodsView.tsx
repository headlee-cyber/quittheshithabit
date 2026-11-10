import { useState, type FormEvent } from 'react';
import { newId } from '../lib/date';
import { kcalFromMacros, searchFoods } from '../lib/nutrition';
import type { Repo } from '../store/repo';
import type { Food } from '../types';

interface Props {
  repo: Repo;
  foods: Food[];
  onChange: () => Promise<void>;
}

const EMPTY = { name: '', protein: '', fat: '', carbs: '', kcal: '', servingG: '' };

export function FoodsView({ repo, foods, onChange }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const num = (s: string) => (s === '' ? 0 : Number(s));
  const autoKcal = kcalFromMacros({ protein: num(form.protein), fat: num(form.fat), carbs: num(form.carbs) });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const food: Food = {
      id: editingId ?? newId(),
      name: form.name.trim(),
      protein: num(form.protein),
      fat: num(form.fat),
      carbs: num(form.carbs),
      kcal: form.kcal === '' ? autoKcal : num(form.kcal),
      servingG: form.servingG === '' ? undefined : num(form.servingG),
    };
    try {
      await repo.upsertFood(food);
      setForm(EMPTY);
      setEditingId(null);
      await onChange();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const edit = (f: Food) => {
    setEditingId(f.builtin ? null : f.id); // 組み込み食品はコピーして新規登録
    setForm({
      name: f.name,
      protein: String(f.protein),
      fat: String(f.fat),
      carbs: String(f.carbs),
      kcal: String(f.kcal),
      servingG: f.servingG ? String(f.servingG) : '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (f: Food) => {
    if (!confirm(`「${f.name}」を削除しますか？（過去の記録は残ります）`)) return;
    try {
      await repo.deleteFood(f.id);
      await onChange();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const list = searchFoods(foods, query);

  return (
    <div className="stack">
      <h1>食品</h1>
      {error && <div className="error">{error}</div>}
      <form className="card stack" onSubmit={submit}>
        <h2>{editingId ? '食品を編集' : '食品を登録'}（100gあたり）</h2>
        <input placeholder="名前" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <div className="grid4">
          {(
            [
              ['protein', 'P (g)'],
              ['fat', 'F (g)'],
              ['carbs', 'C (g)'],
              ['kcal', 'kcal'],
            ] as const
          ).map(([k, label]) => (
            <label key={k}>
              {label}
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder={k === 'kcal' ? String(autoKcal) : ''}
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <label>
          1食分の目安 (g・任意)
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={form.servingG}
            onChange={(e) => setForm({ ...form, servingG: e.target.value })}
          />
        </label>
        <p className="muted small">商品の表示が「1個あたり」の場合は、100gあたりに換算して入力してください。</p>
        <div className="row">
          <button className="primary" disabled={!form.name.trim()}>
            {editingId ? '更新' : '登録'}
          </button>
          {(editingId || form.name) && (
            <button
              type="button"
              onClick={() => {
                setForm(EMPTY);
                setEditingId(null);
              }}
            >
              キャンセル
            </button>
          )}
        </div>
      </form>

      <input placeholder="検索" value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul className="card entries">
        {list.map((f) => (
          <li key={f.id}>
            <div>
              <div>
                {f.name} {f.builtin && <span className="tag">組み込み</span>}
              </div>
              <div className="muted small num">
                {f.kcal}kcal P{f.protein} F{f.fat} C{f.carbs}
                {f.servingG ? ` ・目安${f.servingG}g` : ''}
              </div>
            </div>
            <div className="row tight">
              <button className="link" onClick={() => edit(f)}>
                {f.builtin ? 'コピー' : '編集'}
              </button>
              {!f.builtin && (
                <button className="icon" onClick={() => remove(f)} aria-label="削除">
                  ×
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="muted small">組み込み食品は日本食品標準成分表(八訂)を参考にした目安値です。</p>
    </div>
  );
}
