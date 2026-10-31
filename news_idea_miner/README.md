# news_idea_miner

RSSでニュースを集める → AI(Claude)がビジネスアナリストとして「不利益を受ける人・不満・問題点」を抽出 →
オンライン完結で解決できるアイデアを約100件出す → スコア順に並べて `reports/YYYY-MM-DD.md` に保存。

## 毎日自動で回す(GitHub Actions)
1. https://console.anthropic.com で API キーを発行
2. このリポジトリの Settings → Secrets and variables → Actions → `ANTHROPIC_API_KEY` を登録
3. Actions タブ → `daily-ideas` → `Run workflow` で初回実行。以後は毎朝 6:13 (JST) に自動実行

## 手元で回す
```bash
pip install -r news_idea_miner/requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...
python news_idea_miner/miner.py --dry-run   # まずニュース取得だけ確認(無料)
python news_idea_miner/miner.py
```

## 設定 (`config.json`)
- 国を変える: Google News の URL の `hl` / `gl` / `ceid` を変更(例: 米国 `hl=en-US&gl=US&ceid=US:en`)
- フィード追加: カテゴリ名に RSS の URL を追加(NHK、日経、業界紙など)
- 件数: `ideas_per_category` × カテゴリ数 ≒ 1日の件数(初期値 17×6=102)
- 並び順の重み: `miner.py` の `score()`(実現性40% / 需要25% / 作りやすさ20% / 低リスク15%)

## 費用の目安
1日 6回の API 呼び出し、出力合計 5〜6万トークン程度で、およそ $1〜1.5/日(月 $30〜45)。
実際の値は実行ログの `in= out=` で確認してください。
