import { useCallback, useEffect, useState } from 'react';
import { addDays, formatJa, today } from '../lib/date';
import { sumMacros } from '../lib/nutrition';
import type { Repo } from '../store/repo';
import { MEAL_LABELS, type Food, type Macros, type MealEntry, type MealType } from '../types';
import { AddMealForm } from './AddMealForm';
import { MacroBars } from './MacroBars';

interface Props {
  repo: Repo;
  foods: Food[];
  targets: Macros | null;
  onNeedProfile: () => void;
}

export function TodayView({ repo, foods, targets, onNeedProfile }: Props) {
  const [date, setDate] = useState(today);
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    repo.listMeals(date).then(setEntries, (e: Error) => setError(e.message));
  }, [repo, date]);
  useEffect(reload, [reload]);

  const total = sumMacros(entries);

  const add = async (e: MealEntry) => {
    try {
      await repo.addMeal(e);
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const remove = async (id: string) => {
    if (!confirm('この記録を削除しますか？')) return;
    await repo.deleteMeal(id).catch((e: Error) => setError(e.message));
    reload();
  };

  return (
    <div className="stack">
      <header className="date-nav">
        <button onClick={() => setDate(addDays(date, -1))} aria-label="前の日">‹</button>
        <h1>{date === today() ? `今日 ${formatJa(date)}` : formatJa(date)}</h1>
        <button onClick={() => setDate(addDays(date, 1))} aria-label="次の日">›</button>
      </header>
      {error && <div className="error">{error}</div>}

      {targets ? (
        <MacroBars total={total} target={targets} />
      ) : (
        <div className="card">
          <p>目標値を計算するには、まずプロフィールを登録してください。</p>
          <button className="primary" onClick={onNeedProfile}>
            プロフィールを登録
          </button>
        </div>
      )}

      <AddMealForm date={date} foods={foods} onAdd={add} />

      {(Object.keys(MEAL_LABELS) as MealType[]).map((m) => {
        const items = entries.filter((e) => e.meal === m);
        if (items.length === 0) return null;
        const sub = sumMacros(items);
        return (
          <section key={m} className="card">
            <div className="section-head">
              <h2>{MEAL_LABELS[m]}</h2>
              <span className="muted small num">
                {sub.kcal}kcal P{sub.protein} F{sub.fat} C{sub.carbs}
              </span>
            </div>
            <ul className="entries">
              {items.map((e) => (
                <li key={e.id}>
                  <div>
                    <div>
                      {e.name}
                      {e.grams != null && <span className="muted small"> {e.grams}g</span>}
                    </div>
                    <div className="muted small num">
                      {e.kcal}kcal P{e.protein} F{e.fat} C{e.carbs}
                    </div>
                  </div>
                  <button className="icon" onClick={() => remove(e.id)} aria-label="削除">
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
