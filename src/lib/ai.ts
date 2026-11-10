import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { PreparedImage } from './image';

const KEY_STORAGE = 'macro-app:anthropic-api-key';
export const MODEL = 'claude-opus-5-5';
/** 料金の目安表示用 (USD / 100万トークン) */
const PRICE = { input: 4, output: 20 };

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function setApiKey(key: string): void {
  if (key) localStorage.setItem(KEY_STORAGE, key);
  else localStorage.removeItem(KEY_STORAGE);
}

const EstimateSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().describe('料理・食品名 (日本語)'),
      grams: z.number().describe('可食部の推定重量 (g)'),
      kcal: z.number(),
      protein: z.number().describe('タンパク質 (g)'),
      fat: z.number().describe('脂質 (g)'),
      carbs: z.number().describe('炭水化物 (g)'),
    }),
  ),
  confidence: z.enum(['low', 'medium', 'high']),
  comment: z.string().describe('推定の前提や不確かな点を日本語で1〜2文'),
});

export type Estimate = z.infer<typeof EstimateSchema>;
export interface EstimateResult extends Estimate {
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
}

const SYSTEM = `あなたは食事写真から栄養価を推定する管理栄養士のアシスタントです。
筋力トレーニング中の利用者が、毎日の摂取量を記録するために使います。

手順:
- 写真に写っている料理・食品を、皿や容器ごとではなく、栄養価が異なる単位 (例: ご飯、唐揚げ、千切りキャベツ) に分けて列挙する。
- 器の大きさ、箸やスプーンなどの対比物から、各品目の可食部の重量 (g) を推定する。
- 日本食品標準成分表の値を基準に、その重量でのエネルギー (kcal)・タンパク質・脂質・炭水化物 (g) を推定する。
- 揚げ油、炒め油、ドレッシング、ソースなど、見えにくいが量の多い要素も推定に含める。
- 商品パッケージや栄養成分表示が写っていれば、その値を優先する。
- 利用者からの補足メモがあれば、写真より優先して反映する。

数値は小数第1位まで。食べ物が写っていない場合は items を空にし、comment で理由を伝える。
confidence は、品目の特定と量の推定がどれだけ確かかを表す。`;

export async function estimateFromPhoto(image: PreparedImage, note: string): Promise<EstimateResult> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('APIキーが設定されていません。「設定」タブで登録してください。');

  // 個人利用のため、端末に保存したキーでブラウザから直接呼び出す
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  let res;
  try {
    res = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(EstimateSchema) },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } },
            { type: 'text', text: note.trim() ? `補足メモ: ${note.trim()}` : 'この食事の栄養価を推定してください。' },
          ],
        },
      ],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('APIキーが無効です。「設定」タブで確認してください。');
    if (e instanceof Anthropic.PermissionDeniedError) throw new Error('このAPIキーではモデルを利用できません。');
    if (e instanceof Anthropic.RateLimitError) throw new Error('利用回数の上限に達しました。少し待ってから再度お試しください。');
    if (e instanceof Anthropic.BadRequestError) throw new Error(`リクエストが拒否されました: ${e.message}`);
    if (e instanceof Anthropic.APIConnectionError) throw new Error('通信できませんでした。電波状況を確認してください。');
    if (e instanceof Anthropic.APIError) throw new Error(`APIエラー (${e.status}): ${e.message}`);
    throw e;
  }

  if (res.stop_reason === 'refusal') throw new Error('この画像は推定できませんでした。別の写真でお試しください。');
  if (res.stop_reason === 'max_tokens' || !res.parsed_output) throw new Error('推定結果を読み取れませんでした。もう一度お試しください。');

  const inputTokens = res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0);
  const outputTokens = res.usage.output_tokens;
  return {
    ...res.parsed_output,
    usage: { inputTokens, outputTokens, costUsd: (inputTokens * PRICE.input + outputTokens * PRICE.output) / 1_000_000 },
  };
}
