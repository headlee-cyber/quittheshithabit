// AI が返した計画の検証と、AI に渡す入力の組み立て。ブラウザ API に依存しない純粋関数のみ。
import type { Todo } from './parse';

/** カレンダー上の既存の予定（当日分、時刻はローカルの HH:MM） */
export interface CalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
}

/** AI が提案した時間枠 */
export interface Block {
  id: string;
  title: string;
  start: string;
  end: string;
  /** 対応するタスク。休憩・昼食などは持たない */
  todoId?: string;
  /** Google カレンダーに登録済みならそのイベント ID */
  eventId?: string;
  /** 既存の予定や他の枠と時間が重なっている */
  conflict: boolean;
}

export interface Plan {
  date: string;
  blocks: Block[];
  unscheduled: { title: string; reason: string }[];
  comment: string;
}

export interface PlanPrefs {
  dayStart: string;
  dayEnd: string;
  prefs: string;
}

/** AI の出力（構造化出力のスキーマと同じ形） */
export interface RawPlan {
  tasks: { key: string; title: string; minutes: number }[];
  blocks: { ref: string; title: string; start: string; end: string }[];
  unscheduled: { title: string; reason: string }[];
  comment: string;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function overlaps(a: { start: string; end: string }, b: { start: string; end: string }): boolean {
  return toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);
}

/**
 * AI の出力をアプリのデータに変換する。
 * 時刻が不正な枠は捨て、既存の予定や他の枠と重なる枠には conflict を付ける（黙って消さない）。
 */
export function buildPlan(
  raw: RawPlan,
  todos: Todo[],
  events: CalEvent[],
  date: string,
  now: Date,
  newId: () => string,
): { plan: Plan; newTodos: Todo[] } {
  const keyToId = new Map<string, string>();
  const newTodos: Todo[] = [];
  raw.tasks.forEach((t, i) => {
    const title = t.title.trim();
    if (!title) return;
    const id = newId();
    keyToId.set(t.key, id);
    newTodos.push({
      id,
      title,
      done: false,
      due: date,
      createdAt: now.getTime() + i,
      ...(t.minutes > 0 ? { minutes: Math.round(t.minutes) } : {}),
    });
  });

  const existing = new Set(todos.map((t) => t.id));
  const timed = events.filter((e) => !e.allDay);
  const blocks: Block[] = raw.blocks
    .filter((b) => HHMM.test(b.start) && HHMM.test(b.end) && toMin(b.start) < toMin(b.end) && b.title.trim())
    .sort((a, b) => toMin(a.start) - toMin(b.start))
    .map((b) => {
      const todoId = keyToId.get(b.ref) ?? (existing.has(b.ref) ? b.ref : undefined);
      return {
        id: newId(),
        title: b.title.trim(),
        start: b.start,
        end: b.end,
        conflict: false,
        ...(todoId ? { todoId } : {}),
      };
    });
  for (const b of blocks) {
    b.conflict = timed.some((e) => overlaps(b, e)) || blocks.some((o) => o !== b && overlaps(b, o));
  }

  return {
    plan: { date, blocks, unscheduled: raw.unscheduled, comment: raw.comment.trim() },
    newTodos,
  };
}

export interface PlanInput {
  date: string;
  now: Date;
  transcript: string;
  todos: Todo[];
  events: CalEvent[];
  /** カレンダーを取得できているか。false なら予定は不明として扱わせる */
  calendarLoaded: boolean;
  prefs: PlanPrefs;
  /** 修正を頼む場合の、直前の計画と指示 */
  previous?: Plan;
  instruction?: string;
}

/** AI に渡すユーザーメッセージを組み立てる */
export function buildPlanMessage(input: PlanInput): string {
  const { date, now, transcript, todos, events, calendarLoaded, prefs, previous, instruction } = input;
  const [y, m, d] = date.split('-').map(Number);
  const weekday = '日月火水木金土'[new Date(y, m - 1, d).getDay()];
  const lines: string[] = [];

  lines.push(`今日: ${date}（${weekday}） 現在時刻: ${hhmm(now)}`);
  lines.push(`活動時間帯: ${prefs.dayStart}〜${prefs.dayEnd}`);
  if (prefs.prefs.trim()) lines.push(`<preferences>\n${prefs.prefs.trim()}\n</preferences>`);

  const cal = !calendarLoaded
    ? '（カレンダー未連携。既存の予定は不明）'
    : events.length === 0
      ? '（今日の予定なし）'
      : events.map((e) => (e.allDay ? `- 終日: ${e.title}` : `- ${e.start}-${e.end} ${e.title}`)).join('\n');
  lines.push(`<calendar>\n${cal}\n</calendar>`);

  const active = todos.filter((t) => !t.done);
  const tasks = active.length
    ? active.map((t) => `- [${t.id}] ${t.title}${t.due ? `（期限: ${t.due}）` : ''}`).join('\n')
    : '（なし）';
  lines.push(`<existing_tasks>\n${tasks}\n</existing_tasks>`);

  lines.push(`<speech>\n${transcript.trim() || '（発話なし。既存タスクだけで計画する）'}\n</speech>`);

  if (previous) {
    const prev = previous.blocks.map((b) => `- ${b.start}-${b.end} ${b.title}${b.todoId ? ` [${b.todoId}]` : ''}`).join('\n');
    lines.push(`<previous_plan>\n${prev || '（枠なし）'}\n</previous_plan>`);
    lines.push(`<instruction>\n${(instruction ?? '').trim()}\n</instruction>`);
  }
  return lines.join('\n\n');
}
