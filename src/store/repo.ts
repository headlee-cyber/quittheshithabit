import type { Food, MealEntry, Profile, WeightEntry } from '../types';

export interface Repo {
  getProfile(): Promise<Profile | null>;
  saveProfile(p: Profile): Promise<void>;

  listFoods(): Promise<Food[]>;
  upsertFood(f: Food): Promise<void>;
  deleteFood(id: string): Promise<void>;

  listMeals(date: string): Promise<MealEntry[]>;
  addMeal(e: MealEntry): Promise<void>;
  deleteMeal(id: string): Promise<void>;

  listWeights(): Promise<WeightEntry[]>;
  upsertWeight(w: WeightEntry): Promise<void>;
  deleteWeight(date: string): Promise<void>;
}
