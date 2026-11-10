import type { Food, Goal, Macros, Profile } from '../types';

/** Mifflin-St Jeor 式による基礎代謝 (kcal/日) */
export function bmr(p: Pick<Profile, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return base + (p.sex === 'male' ? 5 : -161);
}

export function tdee(p: Profile): number {
  return bmr(p) * p.activity;
}

export const DEFAULT_KCAL_ADJUST: Record<Goal, number> = {
  bulk: 300,
  maintain: 0,
  cut: -500,
};

export function calcTargets(p: Profile): Macros {
  const kcal = Math.max(0, tdee(p) + p.kcalAdjust);
  const protein = p.weightKg * p.proteinPerKg;
  const fat = (kcal * p.fatRatio) / 9;
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);
  return roundMacros({ kcal, protein, fat, carbs });
}

/** 100g あたりの値から、指定グラム数の栄養価を計算 */
export function scaleFood(food: Macros, grams: number): Macros {
  const r = grams / 100;
  return roundMacros({
    kcal: food.kcal * r,
    protein: food.protein * r,
    fat: food.fat * r,
    carbs: food.carbs * r,
  });
}

export function sumMacros(items: Macros[]): Macros {
  return roundMacros(
    items.reduce(
      (a, b) => ({
        kcal: a.kcal + b.kcal,
        protein: a.protein + b.protein,
        fat: a.fat + b.fat,
        carbs: a.carbs + b.carbs,
      }),
      { kcal: 0, protein: 0, fat: 0, carbs: 0 },
    ),
  );
}

/** PFC から計算したカロリー (アトウォーター係数 4/9/4) */
export function kcalFromMacros(m: Omit<Macros, 'kcal'>): number {
  return Math.round(m.protein * 4 + m.fat * 9 + m.carbs * 4);
}

export function roundMacros(m: Macros): Macros {
  return {
    kcal: Math.round(Number(m.kcal.toPrecision(12))),
    protein: round1(m.protein),
    fat: round1(m.fat),
    carbs: round1(m.carbs),
  };
}

/** 小数第1位に四捨五入。1.9 * 1.5 = 2.8499… のような浮動小数点誤差を吸収する */
export function round1(n: number): number {
  return Math.round(Number((n * 10).toPrecision(12))) / 10;
}

/** 名前の部分一致で食品を検索 (ひらがな/カタカナ・大文字小文字を区別しない) */
export function searchFoods(foods: Food[], q: string): Food[] {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
      .replace(/\s+/g, '');
  const nq = norm(q);
  if (!nq) return foods;
  return foods.filter((f) => norm(f.name).includes(nq));
}

/**
 * 各記録日について、その日を含む過去 days 日間 (暦日) にある記録の平均。
 * 記録が飛び飛びでも「7日平均」が暦日どおりの意味になるようにする。
 * 期間内の記録が minCount 件未満なら null。
 */
export function rollingAverageByDays(
  entries: { date: string; kg: number }[],
  days: number,
  minCount = 2,
): (number | null)[] {
  const t = (iso: string) => Date.parse(iso + 'T00:00:00Z') / 86_400_000;
  return entries.map((e) => {
    const end = t(e.date);
    const win = entries.filter((x) => t(x.date) <= end && t(x.date) > end - days);
    if (win.length < minCount) return null;
    return round1(win.reduce((a, b) => a + b.kg, 0) / win.length);
  });
}
