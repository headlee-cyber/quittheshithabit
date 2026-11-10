import type { Food, MealEntry, Profile, WeightEntry } from '../types';

export interface Repo {
  readonly kind: 'local' | 'supabase';
  getProfile(): Promise<Profile | null>;
  saveProfile(p: Profile): Promise<void>;

  listFoods(): Promise<Food[]>;
  upsertFood(f: Food): Promise<void>;
  deleteFood(id: string): Promise<void>;

  listMeals(date: string): Promise<MealEntry[]>;
  /** 期間内の全記録 (from, to は両端含む) */
  listMealsInRange(from: string, to: string): Promise<MealEntry[]>;
  addMeal(e: MealEntry): Promise<void>;
  deleteMeal(id: string): Promise<void>;

  listWeights(): Promise<WeightEntry[]>;
  upsertWeight(w: WeightEntry): Promise<void>;
  deleteWeight(date: string): Promise<void>;
}
