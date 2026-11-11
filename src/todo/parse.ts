// 音声（またはテキスト）の発話を To Do 操作に変換する。ブラウザ API に依存しない純粋関数のみ。

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  /** 期限（ローカル日付 YYYY-MM-DD） */
  due?: string;
  createdAt: number;
}

export type Target = { kind: 'index'; index: number } | { kind: 'query'; query: string };

export type Command =
  | { type: 'add'; title: string; due?: string }
  | { type: 'complete'; target: Target }
  | { type: 'uncomplete'; target: Target }
  | { type: 'delete'; target: Target }
  | { type: 'clearCompleted' }
  | { type: 'undo' }
  | { type: 'none' };

export interface ExecResult {
  todos: Todo[];
  message: string;
  changed: boolean;
}

// ---------- 日付 ----------

export function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

const WEEKDAYS = '日月火水木金土';

interface DueMatch {
  index: number;
  length: number;
  date: Date;
}

function findDue(text: string, now: Date): DueMatch | undefined {
  const found: DueMatch[] = [];
  const push = (m: RegExpExecArray | null, date: Date | undefined) => {
    if (m && date) found.push({ index: m.index, length: m[0].length, date });
  };

  push(/明後日|あさって/.exec(text), addDays(now, 2));
  push(/明日|あした/.exec(text), addDays(now, 1));
  push(/今日|本日/.exec(text), addDays(now, 0));

  const after = /(\d+)日後/.exec(text);
  push(after, after ? addDays(now, Number(after[1])) : undefined);

  // 「11月20日」「20日」。「3日間」「3日分」などは日付として扱わない
  const md = /(?:(\d{1,2})月\s*)?(\d{1,2})日(?![分間目後前以])/.exec(text);
  if (md) {
    const day = Number(md[2]);
    let date: Date | undefined;
    if (md[1]) {
      const month = Number(md[1]);
      date = new Date(now.getFullYear(), month - 1, day);
      if (date.getMonth() !== month - 1 || date.getDate() !== day) date = undefined;
      else if (ymd(date) < ymd(now)) date = new Date(now.getFullYear() + 1, month - 1, day);
    } else {
      date = new Date(now.getFullYear(), now.getMonth(), day);
      if (date.getDate() !== day) date = undefined;
      else if (ymd(date) < ymd(now)) {
        date = new Date(now.getFullYear(), now.getMonth() + 1, day);
        if (date.getDate() !== day) date = undefined;
      }
    }
    push(md, date);
  }

  // 「金曜」「来週の月曜日」。今日と同じ曜日は1週間後として扱う
  const wd = /(今週の?|来週の?|次の)?\s*([日月火水木金土])曜日?/.exec(text);
  if (wd) {
    const target = WEEKDAYS.indexOf(wd[2]);
    let date: Date;
    if (wd[1]?.startsWith('来週')) {
      const toNextMonday = ((8 - now.getDay()) % 7) || 7;
      date = addDays(now, toNextMonday + ((target + 6) % 7));
    } else {
      date = addDays(now, ((target - now.getDay() + 7) % 7) || 7);
    }
    push(wd, date);
  }

  return found.sort((a, b) => a.index - b.index)[0];
}

/** 「明日までに牛乳を買う」→ { title: '牛乳を買う', due: 明日 } */
export function parseAdd(text: string, now: Date): { title: string; due?: string } {
  const original = cleanText(text);
  const m = findDue(original, now);
  if (!m) return { title: original };
  const rest =
    original.slice(0, m.index) +
    original.slice(m.index + m.length).replace(/^\s*(?:までに|まで|中に|に|の|は)/, '');
  const title = rest.replace(/^[\s、,]+/, '').replace(/\s+/g, ' ').trim();
  // 日付だけの発話は、そのままタイトルとして残す
  if (!title) return { title: original };
  return { title, due: ymd(m.date) };
}

// ---------- 発話の解釈 ----------

function cleanText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[。.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const KANJI_NUM = '一二三四五六七八九十';

function parseTarget(raw: string): Target {
  const m = /^(\d+|[一二三四五六七八九十])(?:番目?|つ目)(?:のタスク|のやつ)?$/.exec(raw);
  if (m) {
    const index = /\d/.test(m[1]) ? Number(m[1]) : KANJI_NUM.indexOf(m[1]) + 1;
    return { kind: 'index', index };
  }
  return { kind: 'query', query: raw };
}

const POLITE = '(?:ください|下さい)?';
const UNDO = new RegExp(`^(?:元に戻(?:す|して)|取り消(?:し|して|す)|やり直(?:し|して|す))${POLITE}$`);
const CLEAR = new RegExp(
  `^(?:完了済み|完了した|終わった|済んだ|チェック済み)の?(?:もの|タスク|やつ)?を?(?:全部|すべて|全て)?(?:削除|消去|消して|消す|クリア)(?:して|する)?${POLITE}$`,
);
const ADD_SUFFIX = /\s*(?:を|って)?\s*(?:追加|登録)(?:して|する)?(?:ください|下さい|おいて)?$/;
const ADD_PREFIX = /^(?:タスク)?(?:追加|登録)[\s、,:]+/;
const UNCOMPLETE = new RegExp(
  `^(.+?)(?:を|は)?(?:未完了(?:に(?:して|する|戻して|戻す))?|のチェックを(?:外して|外す))${POLITE}$`,
);
const DELETE = new RegExp(`^(.+?)(?:を|は)?(?:削除|消去|消して|消す)(?:して|する)?${POLITE}$`);
const COMPLETE = new RegExp(
  `^(.+?)(?:を|は|が|も)?(?:完了|終了|終わった|終わりました|終わり|できた|できました|済み|済んだ|やった|やりました|チェック)(?:にして|にする|して|した|する|しました)?${POLITE}$`,
);

/**
 * 発話を操作に変換する。
 * 「〜を追加」と明示すれば必ず追加になる。操作の語尾（完了・削除など）がなければ追加として扱う。
 */
export function parseCommand(text: string, now: Date): Command {
  const t = cleanText(text);
  if (!t) return { type: 'none' };
  const s = t.replace(/\s+/g, '');

  if (UNDO.test(s)) return { type: 'undo' };
  if (CLEAR.test(s)) return { type: 'clearCompleted' };

  const explicitAdd = ADD_SUFFIX.test(t) || ADD_PREFIX.test(t);
  if (!explicitAdd) {
    let m = UNCOMPLETE.exec(s);
    if (m) return { type: 'uncomplete', target: parseTarget(m[1]) };
    m = DELETE.exec(s);
    if (m) return { type: 'delete', target: parseTarget(m[1]) };
    m = COMPLETE.exec(s);
    if (m) return { type: 'complete', target: parseTarget(m[1]) };
  }

  const body = t.replace(ADD_SUFFIX, '').replace(ADD_PREFIX, '').trim();
  if (!body) return { type: 'none' };
  return { type: 'add', ...parseAdd(body, now) };
}

// ---------- 照合 ----------

function normalizeForMatch(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s、。,.!?「」・ー-]/g, '');
}

function bigrams(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

/** 0〜1 の類似度。完全一致 1、部分一致 0.8 以上、それ以外は bigram の Dice 係数 */
export function similarity(a: string, b: string): number {
  const x = normalizeForMatch(a);
  const y = normalizeForMatch(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) {
    return 0.8 + (0.2 * Math.min(x.length, y.length)) / Math.max(x.length, y.length);
  }
  const bx = bigrams(x);
  const by = bigrams(y);
  if (!bx.length || !by.length) return 0;
  const pool = [...by];
  let hit = 0;
  for (const g of bx) {
    const i = pool.indexOf(g);
    if (i >= 0) {
      hit++;
      pool.splice(i, 1);
    }
  }
  return (2 * hit) / (bx.length + by.length);
}

const MATCH_THRESHOLD = 0.5;

/** 未完了タスクの表示順（期限が近い順 → 追加順）。「1番」などの番号はこの順に対応する */
export function sortActive(todos: Todo[]): Todo[] {
  return todos
    .filter((t) => !t.done)
    .sort((a, b) => {
      if (a.due !== b.due) {
        if (!a.due) return 1;
        if (!b.due) return -1;
        return a.due < b.due ? -1 : 1;
      }
      return a.createdAt - b.createdAt;
    });
}

function resolve(target: Target, pool: Todo[], indexable: Todo[]): Todo | undefined {
  if (target.kind === 'index') return indexable[target.index - 1];
  let best: Todo | undefined;
  let bestScore = MATCH_THRESHOLD;
  for (const t of pool) {
    const sc = similarity(t.title, target.query);
    if (sc > bestScore || (sc === bestScore && !best)) {
      best = t;
      bestScore = sc;
    }
  }
  return best;
}

function describe(target: Target): string {
  return target.kind === 'index' ? `${target.index}番` : `「${target.query}」`;
}

// ---------- 実行 ----------

/** 操作を適用して新しいリストと結果メッセージを返す（undo は呼び出し側で処理する） */
export function execute(todos: Todo[], cmd: Command, now: Date, newId: () => string): ExecResult {
  const unchanged = (message: string): ExecResult => ({ todos, message, changed: false });
  const active = sortActive(todos);
  const done = todos.filter((t) => t.done);

  switch (cmd.type) {
    case 'add': {
      const todo: Todo = {
        id: newId(),
        title: cmd.title,
        done: false,
        createdAt: now.getTime(),
        ...(cmd.due ? { due: cmd.due } : {}),
      };
      return { todos: [...todos, todo], message: `追加: ${cmd.title}`, changed: true };
    }
    case 'complete': {
      const hit = resolve(cmd.target, active, active);
      if (!hit) return unchanged(`${describe(cmd.target)} に近い未完了のタスクが見つかりません`);
      return {
        todos: todos.map((t) => (t.id === hit.id ? { ...t, done: true } : t)),
        message: `完了: ${hit.title}`,
        changed: true,
      };
    }
    case 'uncomplete': {
      const hit = resolve(cmd.target, done, []);
      if (!hit) return unchanged(`${describe(cmd.target)} に近い完了済みのタスクが見つかりません`);
      return {
        todos: todos.map((t) => (t.id === hit.id ? { ...t, done: false } : t)),
        message: `未完了に戻しました: ${hit.title}`,
        changed: true,
      };
    }
    case 'delete': {
      const hit = resolve(cmd.target, [...active, ...done], active);
      if (!hit) return unchanged(`${describe(cmd.target)} に近いタスクが見つかりません`);
      return {
        todos: todos.filter((t) => t.id !== hit.id),
        message: `削除: ${hit.title}`,
        changed: true,
      };
    }
    case 'clearCompleted': {
      if (!done.length) return unchanged('完了済みのタスクはありません');
      return {
        todos: todos.filter((t) => !t.done),
        message: `完了済み ${done.length} 件を削除しました`,
        changed: true,
      };
    }
    default:
      return unchanged('聞き取れませんでした');
  }
}
