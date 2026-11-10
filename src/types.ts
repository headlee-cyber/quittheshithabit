export type Sex = 'male' | 'female';
export type Goal = 'bulk' | 'maintain' | 'cut';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Macros {
  kcal: number;
  protein: number; // g
  fat: number; // g
  carbs: number; // g
}

export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  /** 活動係数 (1.2〜1.9) */
  activity: number;
  goal: Goal;
  /** 目的ごとのカロリー増減 (kcal/日)。bulk なら正、cut なら負 */
  kcalAdjust: number;
  /** 体重1kgあたりのタンパク質 (g) */
  proteinPerKg: number;
  /** 総カロリーに占める脂質の割合 (0〜1) */
  fatRatio: number;
}

/** 100g あたりの栄養価 */
export interface Food extends Macros {
  id: string;
  name: string;
  /** 1食分の目安量 (g)。入力時の初期値に使う */
  servingG?: number;
  builtin?: boolean;
}

export interface MealEntry extends Macros {
  id: string;
  date: string; // YYYY-MM-DD
  meal: MealType;
  name: string;
  grams: number | null; // 手入力の場合は null
}

export interface WeightEntry {
  date: string; // YYYY-MM-DD
  kg: number;
}

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '朝食',
  lunch: '昼食',
  dinner: '夕食',
  snack: '間食',
};
