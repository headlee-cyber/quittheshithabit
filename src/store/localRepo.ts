import type { Food, MealEntry, Profile, WeightEntry } from '../types';
import type { Repo } from './repo';

const KEY = 'macro-app:v1';

export interface Data {
  profile: Profile | null;
  foods: Food[];
  meals: MealEntry[];
  weights: WeightEntry[];
}

function load(): Data {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Data;
  } catch {
    /* 壊れたデータや無効化されたストレージは空として扱う */
  }
  return { profile: null, foods: [], meals: [], weights: [] };
}

function save(d: Data) {
  localStorage.setItem(KEY, JSON.stringify(d));
}

function mutate(fn: (d: Data) => void): Promise<void> {
  const d = load();
  fn(d);
  save(d);
  return Promise.resolve();
}

export const localRepo: Repo = {
  getProfile: async () => load().profile,
  saveProfile: (p) => mutate((d) => void (d.profile = p)),

  listFoods: async () => load().foods,
  upsertFood: (f) =>
    mutate((d) => {
      d.foods = [...d.foods.filter((x) => x.id !== f.id), f];
    }),
  deleteFood: (id) => mutate((d) => void (d.foods = d.foods.filter((x) => x.id !== id))),

  listMeals: async (date) => load().meals.filter((m) => m.date === date),
  addMeal: (e) => mutate((d) => void d.meals.push(e)),
  deleteMeal: (id) => mutate((d) => void (d.meals = d.meals.filter((x) => x.id !== id))),

  listWeights: async () => [...load().weights].sort((a, b) => a.date.localeCompare(b.date)),
  upsertWeight: (w) =>
    mutate((d) => {
      d.weights = [...d.weights.filter((x) => x.date !== w.date), w];
    }),
  deleteWeight: (date) => mutate((d) => void (d.weights = d.weights.filter((x) => x.date !== date))),
};

/** バックアップ用に全データを JSON 文字列として書き出す (APIキーは含めない) */
export function exportData(): string {
  return JSON.stringify({ app: 'macro-app', version: 1, exportedAt: new Date().toISOString(), data: load() }, null, 2);
}

/** バックアップ JSON を読み込み、現在のデータを置き換える */
export function importData(json: string): void {
  const parsed = JSON.parse(json) as { app?: string; data?: Partial<Data> };
  const d = parsed.data;
  if (parsed.app !== 'macro-app' || !d || !Array.isArray(d.meals) || !Array.isArray(d.foods) || !Array.isArray(d.weights)) {
    throw new Error('このアプリのバックアップファイルではありません');
  }
  save({ profile: d.profile ?? null, foods: d.foods, meals: d.meals, weights: d.weights });
}
