import { useRef, useState } from 'react';
import { estimateFromPhoto, getApiKey, type EstimateResult } from '../lib/ai';
import { newId } from '../lib/date';
import { prepareImage, type PreparedImage } from '../lib/image';
import { round1, sumMacros } from '../lib/nutrition';
import { MEAL_LABELS, type Macros, type MealEntry, type MealType } from '../types';
import { defaultMeal } from './AddMealForm';

interface Row extends Macros {
  key: string;
  name: string;
  grams: number;
  include: boolean;
  /** AIの推定値。グラム数を変えたときの比例計算に使う */
  base: Macros & { grams: number };
}

const CONFIDENCE: Record<EstimateResult['confidence'], string> = { low: '低', medium: '中', high: '高' };

interface Props {
  date: string;
  onAdd: (entries: MealEntry[]) => Promise<void>;
  onNeedKey: () => void;
}

export function PhotoEstimate({ date, onAdd, onNeedKey }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [note, setNote] = useState('');
  const [meal, setMeal] = useState<MealType>(defaultMeal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const reset = () => {
    setImage(null);
    setNote('');
    setResult(null);
    setRows([]);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      setImage(await prepareImage(file));
    } catch {
      setError('画像を読み込めませんでした');
    }
  };

  const estimate = async () => {
    if (!image) return;
    setBusy(true);
    setError(null);
    try {
      const r = await estimateFromPhoto(image, note);
      setResult(r);
      setRows(
        r.items.map((it) => ({
          key: newId(),
          name: it.name,
          grams: round1(it.grams),
          kcal: Math.round(it.kcal),
          protein: round1(it.protein),
          fat: round1(it.fat),
          carbs: round1(it.carbs),
          include: true,
          base: { ...it },
        })),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const changeGrams = (row: Row, grams: number) => {
    const ratio = row.base.grams > 0 ? grams / row.base.grams : 0;
    update(row.key, {
      grams,
      ...(ratio > 0 && {
        kcal: Math.round(row.base.kcal * ratio),
        protein: round1(row.base.protein * ratio),
        fat: round1(row.base.fat * ratio),
        carbs: round1(row.base.carbs * ratio),
      }),
    });
  };

  const save = async () => {
    const chosen = rows.filter((r) => r.include && r.name.trim());
    if (chosen.length === 0) return;
    setBusy(true);
    try {
      await onAdd(
        chosen.map((r) => ({
          id: newId(),
          date,
          meal,
          name: r.name.trim(),
          grams: r.grams || null,
          kcal: r.kcal,
          protein: r.protein,
          fat: r.fat,
          carbs: r.carbs,
          source: 'ai' as const,
        })),
      );
      reset();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const hasKey = !!getApiKey();
  const total = sumMacros(rows.filter((r) => r.include));

  return (
    <section className="card stack">
      <div className="section-head">
        <h2>写真で記録 (AI推定)</h2>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => pick(e.target.files?.[0])}
        data-testid="photo-input"
      />

      {!hasKey ? (
        <div className="stack">
          <p className="muted small">写真から推定するには、Anthropic の APIキーを登録してください。</p>
          <button onClick={onNeedKey}>APIキーを登録する</button>
        </div>
      ) : !image ? (
        <button className="primary" onClick={() => fileRef.current?.click()}>
          写真を撮る / 選ぶ
        </button>
      ) : (
        <>
          <img className="photo" src={image.previewUrl} alt="食事の写真" />
          {!result && (
            <>
              <input placeholder="補足メモ (任意・例: ご飯大盛り、マヨ多め)" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="row">
                <button className="primary" onClick={estimate} disabled={busy}>
                  {busy ? '推定中…' : 'AIで推定する'}
                </button>
                <button onClick={reset} disabled={busy}>
                  やめる
                </button>
              </div>
            </>
          )}
        </>
      )}

      {error && <div className="error">{error}</div>}

      {result && (
        <div className="stack">
          <p className="muted small">
            確度: {CONFIDENCE[result.confidence]} ・ {result.comment}
          </p>
          {rows.length === 0 ? (
            <p>食べ物を認識できませんでした。</p>
          ) : (
            <>
              <p className="muted small">AIの推定値です。量を直すとPFCも比例して変わります。数値は個別にも修正できます。</p>
              <ul className="ai-rows">
                {rows.map((r) => (
                  <li key={r.key} className={r.include ? '' : 'off'}>
                    <div className="row">
                      <input
                        type="checkbox"
                        checked={r.include}
                        onChange={(e) => update(r.key, { include: e.target.checked })}
                        aria-label={`${r.name}を記録する`}
                      />
                      <input className="grow" value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} aria-label="品目名" />
                    </div>
                    <div className="grid5">
                      <label>
                        g
                        <input type="number" inputMode="decimal" min="0" step="any" value={r.grams} onChange={(e) => changeGrams(r, Number(e.target.value))} />
                      </label>
                      {(['kcal', 'protein', 'fat', 'carbs'] as const).map((k) => (
                        <label key={k}>
                          {k === 'kcal' ? 'kcal' : k === 'protein' ? 'P' : k === 'fat' ? 'F' : 'C'}
                          <input type="number" inputMode="decimal" min="0" step="any" value={r[k]} onChange={(e) => update(r.key, { [k]: Number(e.target.value) })} />
                        </label>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="num">
                合計 <strong>{total.kcal}</strong>kcal P{total.protein} F{total.fat} C{total.carbs}
              </p>
            </>
          )}
          <div className="row">
            <select value={meal} onChange={(e) => setMeal(e.target.value as MealType)} aria-label="食事区分">
              {Object.entries(MEAL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button className="primary" onClick={save} disabled={busy || !rows.some((r) => r.include)}>
              記録する
            </button>
            <button onClick={reset} disabled={busy}>
              破棄
            </button>
          </div>
          <p className="muted small num">
            今回の利用: 入力 {result.usage.inputTokens.toLocaleString()} / 出力 {result.usage.outputTokens.toLocaleString()} トークン
            （約 ${result.usage.costUsd.toFixed(4)}・目安）
          </p>
        </div>
      )}
    </section>
  );
}
