import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Food, MealEntry, Profile, WeightEntry } from '../types';
import type { Repo } from './repo';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

// DB はスネークケース、アプリはキャメルケース
type FoodRow = { id: string; name: string; kcal: number; protein: number; fat: number; carbs: number; serving_g: number | null };

const toFood = (r: FoodRow): Food => ({
  id: r.id,
  name: r.name,
  kcal: r.kcal,
  protein: r.protein,
  fat: r.fat,
  carbs: r.carbs,
  servingG: r.serving_g ?? undefined,
});

export function createSupabaseRepo(sb: SupabaseClient): Repo {
  return {
    kind: 'supabase',

    async getProfile() {
      const data = check(await sb.from('profiles').select('data').maybeSingle());
      return (data?.data as Profile | undefined) ?? null;
    },
    async saveProfile(p) {
      const { data: u } = await sb.auth.getUser();
      if (!u.user) throw new Error('ログインしていません');
      check(await sb.from('profiles').upsert({ user_id: u.user.id, data: p, updated_at: new Date().toISOString() }));
    },

    async listFoods() {
      const rows = check(await sb.from('foods').select('id,name,kcal,protein,fat,carbs,serving_g').order('name'));
      return (rows as FoodRow[]).map(toFood);
    },
    async upsertFood(f) {
      check(
        await sb.from('foods').upsert({
          id: f.id,
          name: f.name,
          kcal: f.kcal,
          protein: f.protein,
          fat: f.fat,
          carbs: f.carbs,
          serving_g: f.servingG ?? null,
        }),
      );
    },
    async deleteFood(id) {
      check(await sb.from('foods').delete().eq('id', id));
    },

    async listMeals(date) {
      return check(
        await sb.from('meals').select('id,date,meal,name,grams,kcal,protein,fat,carbs').eq('date', date).order('created_at'),
      ) as MealEntry[];
    },
    async listMealsInRange(from, to) {
      return check(
        await sb.from('meals').select('id,date,meal,name,grams,kcal,protein,fat,carbs').gte('date', from).lte('date', to),
      ) as MealEntry[];
    },
    async addMeal(e) {
      check(await sb.from('meals').insert(e));
    },
    async deleteMeal(id) {
      check(await sb.from('meals').delete().eq('id', id));
    },

    async listWeights() {
      return check(await sb.from('weights').select('date,kg').order('date')) as WeightEntry[];
    },
    async upsertWeight(w) {
      const { data: u } = await sb.auth.getUser();
      if (!u.user) throw new Error('ログインしていません');
      check(await sb.from('weights').upsert({ ...w, user_id: u.user.id }, { onConflict: 'user_id,date' }));
    },
    async deleteWeight(date) {
      check(await sb.from('weights').delete().eq('date', date));
    },
  };
}
