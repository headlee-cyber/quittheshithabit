import type { Food, MealEntry, Profile, WeightEntry } from '../types';
import type { Repo } from './repo';

const KEY = 'macro-app:v1';

interface Data {
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
  kind: 'local',
  getProfile: async () => load().profile,
  saveProfile: (p) => mutate((d) => void (d.profile = p)),

  listFoods: async () => load().foods,
  upsertFood: (f) =>
    mutate((d) => {
      d.foods = [...d.foods.filter((x) => x.id !== f.id), f];
    }),
  deleteFood: (id) => mutate((d) => void (d.foods = d.foods.filter((x) => x.id !== id))),

  listMeals: async (date) => load().meals.filter((m) => m.date === date),
  listMealsInRange: async (from, to) => load().meals.filter((m) => m.date >= from && m.date <= to),
  addMeal: (e) => mutate((d) => void d.meals.push(e)),
  deleteMeal: (id) => mutate((d) => void (d.meals = d.meals.filter((x) => x.id !== id))),

  listWeights: async () => [...load().weights].sort((a, b) => a.date.localeCompare(b.date)),
  upsertWeight: (w) =>
    mutate((d) => {
      d.weights = [...d.weights.filter((x) => x.date !== w.date), w];
    }),
  deleteWeight: (date) => mutate((d) => void (d.weights = d.weights.filter((x) => x.date !== date))),
};
