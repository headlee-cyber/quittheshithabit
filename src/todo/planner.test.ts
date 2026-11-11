import { describe, expect, it } from 'vitest';
import type { Todo } from './parse';
import { buildPlan, buildPlanMessage, type CalEvent, type RawPlan } from './planner';

const NOW = new Date(2026, 10, 11, 8, 0, 0);
const DATE = '2026-11-11';

function ids() {
  let n = 0;
  return () => `id${++n}`;
}

const existing: Todo[] = [{ id: 'old1', title: '洗濯', done: false, createdAt: 1 }];
const events: CalEvent[] = [
  { id: 'e1', title: '定例会議', start: '10:00', end: '11:00', allDay: false },
  { id: 'e2', title: '祝日', start: '00:00', end: '23:59', allDay: true },
];

const raw: RawPlan = {
  tasks: [
    { key: 'n1', title: 'レポートを書く', minutes: 90 },
    { key: 'n2', title: ' ', minutes: 10 },
  ],
  blocks: [
    { ref: 'old1', title: '洗濯', start: '11:00', end: '11:30' },
    { ref: 'n1', title: 'レポートを書く', start: '08:30', end: '10:00' },
    { ref: '', title: '昼食', start: '12:00', end: '13:00' },
    { ref: 'n1', title: '壊れた枠', start: '25:00', end: '26:00' },
    { ref: 'ghost', title: '逆転', start: '15:00', end: '14:00' },
  ],
  unscheduled: [{ title: 'ジム', reason: '時間が足りない' }],
  comment: ' 午前に集中作業を置きました ',
};

describe('buildPlan', () => {
  it('新しいタスクを作り、枠をタスクに結び付ける', () => {
    const { plan, newTodos } = buildPlan(raw, existing, events, DATE, NOW, ids());
    expect(newTodos).toHaveLength(1);
    expect(newTodos[0]).toMatchObject({ title: 'レポートを書く', due: DATE, minutes: 90, done: false });
    expect(plan.blocks.map((b) => [b.start, b.title, b.todoId])).toEqual([
      ['08:30', 'レポートを書く', newTodos[0].id],
      ['11:00', '洗濯', 'old1'],
      ['12:00', '昼食', undefined],
    ]);
    expect(plan.blocks.every((b) => !b.conflict)).toBe(true);
    expect(plan.comment).toBe('午前に集中作業を置きました');
    expect(plan.unscheduled).toHaveLength(1);
  });

  it('既存の予定や他の枠と重なる枠に印を付ける（終日の予定は対象外）', () => {
    const r: RawPlan = {
      tasks: [],
      blocks: [
        { ref: '', title: 'A', start: '09:30', end: '10:30' },
        { ref: '', title: 'B', start: '13:00', end: '14:00' },
        { ref: '', title: 'C', start: '13:30', end: '14:30' },
        { ref: '', title: 'D', start: '11:00', end: '12:00' },
      ],
      unscheduled: [],
      comment: '',
    };
    const { plan } = buildPlan(r, [], events, DATE, NOW, ids());
    expect(Object.fromEntries(plan.blocks.map((b) => [b.title, b.conflict]))).toEqual({
      A: true,
      B: true,
      C: true,
      D: false,
    });
  });
});

describe('buildPlanMessage', () => {
  const prefs = { dayStart: '07:00', dayEnd: '22:00', prefs: '昼食は12時台' };

  it('日付・予定・タスク・発話を含める', () => {
    const msg = buildPlanMessage({
      date: DATE, now: NOW, transcript: 'レポートを書きたい', todos: existing, events, calendarLoaded: true, prefs,
    });
    expect(msg).toContain('今日: 2026-11-11（水） 現在時刻: 08:00');
    expect(msg).toContain('- 10:00-11:00 定例会議');
    expect(msg).toContain('- 終日: 祝日');
    expect(msg).toContain('- [old1] 洗濯');
    expect(msg).toContain('レポートを書きたい');
    expect(msg).toContain('昼食は12時台');
    expect(msg).not.toContain('<previous_plan>');
  });

  it('カレンダー未連携を区別して伝える', () => {
    const msg = buildPlanMessage({
      date: DATE, now: NOW, transcript: '', todos: [], events: [], calendarLoaded: false, prefs,
    });
    expect(msg).toContain('カレンダー未連携');
  });
});
