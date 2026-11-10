import type { Food } from '../types';

/**
 * 組み込み食品 (100g あたり)。
 * 日本食品標準成分表(八訂)の値を参考にした目安値です。
 * 正確な値は成分表や商品の栄養成分表示で確認し、必要に応じて「食品」タブで自分用に登録してください。
 * 炭水化物は「炭水化物」の値を用いています。
 */
const raw: Omit<Food, 'id' | 'builtin'>[] = [
  { name: '鶏むね肉(皮なし・生)', kcal: 105, protein: 23.3, fat: 1.9, carbs: 0.1, servingG: 150 },
  { name: '鶏ささみ(生)', kcal: 98, protein: 23.9, fat: 0.8, carbs: 0.1, servingG: 100 },
  { name: '鶏もも肉(皮なし・生)', kcal: 113, protein: 19.0, fat: 5.0, carbs: 0, servingG: 150 },
  { name: '鶏卵(全卵・生)', kcal: 142, protein: 12.2, fat: 10.2, carbs: 0.4, servingG: 50 },
  { name: 'ご飯(精白米・炊飯)', kcal: 156, protein: 2.5, fat: 0.3, carbs: 37.1, servingG: 200 },
  { name: 'オートミール', kcal: 350, protein: 13.7, fat: 5.7, carbs: 69.1, servingG: 40 },
  { name: '糸引き納豆', kcal: 190, protein: 16.5, fat: 10.0, carbs: 12.1, servingG: 45 },
  { name: 'バナナ', kcal: 93, protein: 1.1, fat: 0.2, carbs: 22.5, servingG: 100 },
  { name: '普通牛乳', kcal: 61, protein: 3.3, fat: 3.8, carbs: 4.8, servingG: 200 },
  { name: 'ブロッコリー(生)', kcal: 37, protein: 5.4, fat: 0.6, carbs: 6.6, servingG: 80 },
  { name: 'さば水煮缶', kcal: 174, protein: 20.9, fat: 10.7, carbs: 0.2, servingG: 150 },
  { name: 'ヨーグルト(全脂無糖)', kcal: 56, protein: 3.6, fat: 3.0, carbs: 4.9, servingG: 100 },
];

export const SEED_FOODS: Food[] = raw.map((f, i) => ({ ...f, id: `builtin-${i}`, builtin: true }));
