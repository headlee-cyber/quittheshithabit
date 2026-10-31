"""ニュース → 不利益を受ける人/不満/問題点 → オンライン完結のビジネスアイデア を毎日生成する。

使い方:
    export ANTHROPIC_API_KEY=sk-ant-...
    python news_idea_miner/miner.py                 # config.json の設定で実行
    python news_idea_miner/miner.py --dry-run       # RSS取得だけ行い、APIは呼ばない
    python news_idea_miner/miner.py --rss-file a.xml --dry-run   # ローカルのRSSで動作確認
"""

from __future__ import annotations

import argparse
import datetime as dt
import email.utils
import html
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
USER_AGENT = "Mozilla/5.0 (news-idea-miner)"


# ---------------------------------------------------------------- RSS 取得

def parse_rss(xml_bytes: bytes) -> list[dict]:
    """RSS 2.0 / Atom の両方から title, link, published, summary を取り出す。"""
    root = ET.fromstring(xml_bytes)
    items = []
    atom = "{http://www.w3.org/2005/Atom}"
    for node in root.iter():
        tag = node.tag
        if tag == "item":  # RSS 2.0
            title = node.findtext("title") or ""
            link = node.findtext("link") or ""
            pub = node.findtext("pubDate") or ""
            desc = node.findtext("description") or ""
        elif tag == f"{atom}entry":  # Atom
            title = node.findtext(f"{atom}title") or ""
            link_el = node.find(f"{atom}link")
            link = link_el.get("href", "") if link_el is not None else ""
            pub = node.findtext(f"{atom}updated") or node.findtext(f"{atom}published") or ""
            desc = node.findtext(f"{atom}summary") or ""
        else:
            continue
        summary = re.sub(r"<[^>]+>", " ", html.unescape(desc))
        summary = re.sub(r"\s+", " ", summary).strip()[:300]
        items.append({"title": title.strip(), "link": link.strip(), "published": pub.strip(), "summary": summary})
    return items


def fetch_feed(url: str) -> list[dict]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return parse_rss(resp.read())


def is_recent(published: str, hours: int = 36) -> bool:
    if not published:
        return True
    try:
        t = email.utils.parsedate_to_datetime(published)
    except (TypeError, ValueError):
        try:
            t = dt.datetime.fromisoformat(published.replace("Z", "+00:00"))
        except ValueError:
            return True
    if t.tzinfo is None:
        t = t.replace(tzinfo=dt.timezone.utc)
    return dt.datetime.now(dt.timezone.utc) - t <= dt.timedelta(hours=hours)


def collect(categories: dict[str, list[str]], limit: int) -> dict[str, list[dict]]:
    seen: set[str] = set()
    out: dict[str, list[dict]] = {}
    for cat, urls in categories.items():
        bucket = []
        for url in urls:
            try:
                items = fetch_feed(url)
            except Exception as e:  # 1つのフィードが落ちても続行
                print(f"[warn] {cat}: {url} の取得に失敗: {e}", file=sys.stderr)
                continue
            for it in items:
                key = re.sub(r"\s+", "", it["title"])[:60]
                if not it["title"] or key in seen or not is_recent(it["published"]):
                    continue
                seen.add(key)
                bucket.append(it)
        out[cat] = bucket[:limit]
        print(f"[info] {cat}: {len(out[cat])} 件", file=sys.stderr)
    return out


# ---------------------------------------------------------------- AI 分析

class Idea(BaseModel):
    title: str = Field(description="サービス名(仮)")
    source_headline: str = Field(description="根拠にしたニュース見出し(原文のまま)")
    affected_people: str = Field(description="このニュースで不利益・不満を抱える具体的な人")
    problem: str = Field(description="その人が抱える具体的な問題点")
    service: str = Field(description="オンラインだけで提供できる解決策の中身")
    business_model: str = Field(description="買い切り / サブスク / 従量課金 / 手数料 など")
    price_guess: str = Field(description="想定価格(円)")
    first_validation: str = Field(description="作る前に需要を確かめる最安の方法(例: LP+広告1万円, X投稿, 掲示板で聞く)")
    risks: str = Field(description="法規制・競合・一過性など、失敗しうる理由")
    feasibility: int = Field(description="1-10: 個人がAIを使って1-2週間で作って売れる現実性")
    build_ease: int = Field(description="1-10: 実装の容易さ(10が最も容易)")
    demand: int = Field(description="1-10: お金を払ってでも解決したい切実さ")
    low_risk: int = Field(description="1-10: 法務・規制・炎上リスクの低さ(10が最も低リスク)")


class IdeaList(BaseModel):
    ideas: list[Idea]


SYSTEM = """あなたは辛口で現実的なビジネスアナリストです。
与えられたニュース見出しを読み、(1) そのニュースによって不利益を受ける人、不満を抱える人、生じる問題点を特定し、
(2) それを「オンラインだけで提供できるサービス」(Webアプリ、SaaS、テンプレート、データ提供、自動化ツール、情報サービス等)で解決するアイデアにしてください。

条件:
- 個人がAIコーディングで実装・運営できる規模に限る。物理的な在庫、対面対応、許認可が必須のもの(士業独占業務、金融商品の助言、医療行為など)は避けるか、低く採点する。
- 見出しから読み取れない事実を作らない。推測は推測と分かる書き方にする。
- 点数は甘くしない。ほとんどのアイデアは feasibility 3〜6 程度になるのが自然。根拠の薄いものに8以上をつけない。
- 1つのニュースから複数出してもよいが、似たアイデアの水増しはしない。"""


def analyze(client, model: str, category: str, headlines: list[dict], n: int) -> list[dict]:
    lines = "\n".join(
        f"- {h['title']}" + (f" — {h['summary'][:120]}" if h["summary"] and h["summary"] not in h["title"] else "")
        for h in headlines
    )
    prompt = f"カテゴリ: {category}\n\nニュース見出し:\n{lines}\n\nこれらから、アイデアを{n}件出してください。"
    resp = client.messages.parse(
        model=model,
        max_tokens=16000,
        system=SYSTEM,
        output_config={"effort": "medium"},
        messages=[{"role": "user", "content": prompt}],
        output_format=IdeaList,
    )
    if resp.stop_reason == "refusal":
        print(f"[warn] {category}: モデルが応答を拒否したためスキップ", file=sys.stderr)
        return []
    if resp.stop_reason == "max_tokens" or resp.parsed_output is None:
        print(f"[warn] {category}: 出力が途中で切れたためスキップ (stop_reason={resp.stop_reason})", file=sys.stderr)
        return []
    u = resp.usage
    print(f"[info] {category}: in={u.input_tokens} out={u.output_tokens} tokens", file=sys.stderr)
    return [dict(i.model_dump(), category=category) for i in resp.parsed_output.ideas]


def score(idea: dict) -> float:
    """並べ替え用の合成スコア。重みは仮置きなので config で好みに調整してよい。"""
    c = lambda k: max(1, min(10, int(idea.get(k, 1))))
    return round(0.4 * c("feasibility") + 0.25 * c("demand") + 0.2 * c("build_ease") + 0.15 * c("low_risk"), 2)


# ---------------------------------------------------------------- 出力

def write_report(ideas: list[dict], headlines: dict[str, list[dict]], outdir: Path, today: str) -> Path:
    outdir.mkdir(parents=True, exist_ok=True)
    (outdir / f"{today}.json").write_text(
        json.dumps({"date": today, "ideas": ideas, "headlines": headlines}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    md = [f"# ビジネスアイデア {today}", "",
          f"ニュース {sum(len(v) for v in headlines.values())} 件 → アイデア {len(ideas)} 件(合成スコア順)", "",
          "> スコアはAIの自己評価で、実データでの検証はしていません。上位でも `検証方法` を先に試してください。", "",
          "| # | スコア | 実現性 | 需要 | アイデア | カテゴリ |", "|---|---|---|---|---|---|"]
    for i, d in enumerate(ideas, 1):
        md.append(f"| {i} | {d['score']} | {d['feasibility']} | {d['demand']} | {d['title']} | {d['category']} |")
    md.append("")
    for i, d in enumerate(ideas, 1):
        md += [f"## {i}. {d['title']}  (スコア {d['score']})", "",
               f"- **元ニュース**: {d['source_headline']}",
               f"- **困る人**: {d['affected_people']}",
               f"- **問題点**: {d['problem']}",
               f"- **サービス**: {d['service']}",
               f"- **収益モデル / 価格**: {d['business_model']} / {d['price_guess']}",
               f"- **検証方法**: {d['first_validation']}",
               f"- **リスク**: {d['risks']}",
               f"- 実現性 {d['feasibility']} ・ 作りやすさ {d['build_ease']} ・ 需要 {d['demand']} ・ 低リスク {d['low_risk']}", ""]
    path = outdir / f"{today}.md"
    path.write_text("\n".join(md), encoding="utf-8")
    return path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=str(ROOT / "config.json"))
    ap.add_argument("--out", default=str(REPO / "reports"))
    ap.add_argument("--dry-run", action="store_true", help="RSS取得のみ。APIは呼ばない")
    ap.add_argument("--rss-file", help="ネットの代わりにローカルRSSファイルを使う(動作確認用)")
    args = ap.parse_args()

    cfg = json.loads(Path(args.config).read_text(encoding="utf-8"))
    if args.rss_file:
        items = parse_rss(Path(args.rss_file).read_bytes())
        headlines = {"テスト": items[: cfg["max_headlines_per_category"]]}
    else:
        headlines = collect(cfg["categories"], cfg["max_headlines_per_category"])

    if args.dry_run:
        for cat, hs in headlines.items():
            print(f"\n## {cat} ({len(hs)})")
            for h in hs:
                print(f"- {h['title']}")
        return

    import anthropic  # dry-run では不要なので遅延 import
    client = anthropic.Anthropic()
    ideas: list[dict] = []
    for cat, hs in headlines.items():
        if hs:
            ideas += analyze(client, cfg["model"], cat, hs, cfg["ideas_per_category"])
    for d in ideas:
        d["score"] = score(d)
    ideas.sort(key=lambda d: (d["score"], d["feasibility"]), reverse=True)

    today = dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).strftime("%Y-%m-%d")
    path = write_report(ideas, headlines, Path(args.out), today)
    print(f"[done] {len(ideas)} 件 → {path}")


if __name__ == "__main__":
    main()
