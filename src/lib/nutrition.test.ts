import { describe, expect, it } from 'vitest';
import { bmr, calcTargets, rollingAverageByDays, scaleFood, searchFoods, sumMacros } from './nutrition';
import type { Food, Profile } from '../types';

const profile: Profile = {
  sex: 'male',
  age: 30,
  heightCm: 175,
  weightKg: 70,
  activity: 1.55,
  goal: 'bulk',
  kcalAdjust: 300,
  proteinPerKg: 2,
  fatRatio: 0.25,
};

describe('nutrition', () => {
  it('Mifflin-St Jeor の基礎代謝', () => {
    // 10*70 + 6.25*175 - 5*30 + 5 = 1648.75
    expect(bmr(profile)).toBeCloseTo(1648.75);
    expect(bmr({ ...profile, sex: 'female' })).toBeCloseTo(1482.75);
  });

  it('目標PFCの合計がほぼ目標カロリーに一致する', () => {
    const t = calcTargets(profile);
    expect(t.kcal).toBe(Math.round(1648.75 * 1.55 + 300)); // 2856
    expect(t.protein).toBe(140);
    const fromMacros = t.protein * 4 + t.fat * 9 + t.carbs * 4;
    expect(Math.abs(fromMacros - t.kcal)).toBeLessThan(2);
  });

  it('炭水化物は負にならない', () => {
    const t = calcTargets({ ...profile, kcalAdjust: -2500, proteinPerKg: 3 });
    expect(t.carbs).toBe(0);
  });

  it('グラム換算と合計', () => {
    const m = scaleFood({ kcal: 105, protein: 23.3, fat: 1.9, carbs: 0.1 }, 150);
    expect(m).toEqual({ kcal: 158, protein: 35, fat: 2.9, carbs: 0.2 });
    expect(sumMacros([m, m]).protein).toBe(70);
  });

  it('カタカナ/ひらがなを同一視して検索', () => {
    const foods = [{ id: '1', name: 'バナナ' }, { id: '2', name: '白米' }] as Food[];
    expect(searchFoods(foods, 'ばな').map((f) => f.id)).toEqual(['1']);
  });

  it('暦日ベースの7日平均', () => {
    const w = [
      { date: '2026-11-01', kg: 70 },
      { date: '2026-11-03', kg: 71 },
      { date: '2026-11-07', kg: 72 },
      { date: '2026-11-08', kg: 74 },
    ];
    // 11/07 の窓は 11/01〜11/07、11/08 の窓は 11/02〜11/08 (11/01 は外れる)
    expect(rollingAverageByDays(w, 7)).toEqual([null, 70.5, 71, 72.3]);
  });
});
