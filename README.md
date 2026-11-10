# マクロ管理（筋トレ用食事管理 PWA）

PFC・カロリーの記録、目標値の自動計算、食品データベース、体重推移グラフを備えた Web アプリです。
ブラウザで動作し、スマホのホーム画面に追加してアプリのように使えます（PWA）。

## 機能

| タブ | 内容 |
| --- | --- |
| 今日 | 日ごとの食事記録（食品×グラム数 または PFC 手入力）、目標に対する進捗バー |
| 体重 | 体重記録、推移グラフ（暦日ベースの7日平均つき）。最新日の体重は目標計算に自動反映 |
| 食品 | 自分用食品の登録・編集（100g あたり）、組み込み食品のコピー |
| 設定 | プロフィール・目的から目標 kcal / PFC を計算、保存先の表示 |

### 目標値の計算方法

- 基礎代謝: Mifflin-St Jeor 式（男性 `10W + 6.25H − 5A + 5`、女性 `… − 161`）
- 消費カロリー = 基礎代謝 × 活動係数
- 目標カロリー = 消費カロリー + 増減（初期値: 増量 +300 / 維持 0 / 減量 −500 kcal）
- P = 体重 × g/kg（初期値 2.0）、F = 目標カロリー × 脂質割合（初期値 25%）÷ 9、C = 残り ÷ 4

いずれも推定値です。体重の推移を見て「カロリー増減」を調整する前提の作りです。

組み込み食品は日本食品標準成分表(八訂)を参考にした目安値です。正確な値は成分表や商品表示で確認してください。

## 開発

```bash
npm install
npm run dev      # 開発サーバー
npm test         # 計算ロジックのテスト
npm run build    # 本番ビルド（dist/）
```

## データの保存先

- **Supabase 未設定**: ブラウザの localStorage に保存（端末間の同期なし）
- **Supabase 設定済み**: ログインが必要になり、データはクラウドに保存・同期

### Supabase の設定手順

1. https://supabase.com でプロジェクトを作成
2. SQL Editor で `supabase/schema.sql` を実行（テーブル作成と RLS 設定）
3. Project Settings > API の URL と anon key を `.env.local` に記入（`.env.example` をコピー）
4. `npm run dev` を再起動

確認メールを不要にしたい場合は Authentication > Providers > Email の「Confirm email」をオフにします。

※ localStorage に保存したデータは Supabase に自動移行されません。

## 構成

```
src/
  lib/nutrition.ts      目標計算・換算・集計（テストあり）
  store/repo.ts         保存層のインターフェース
  store/localRepo.ts    localStorage 実装
  store/supabaseRepo.ts Supabase 実装
  data/seedFoods.ts     組み込み食品
  components/           各画面
supabase/schema.sql     DB スキーマと RLS
```
