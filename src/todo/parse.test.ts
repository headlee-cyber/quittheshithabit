import { describe, expect, it } from 'vitest';
import { execute, parseAdd, parseCommand, similarity, sortActive, type Todo } from './parse';

// 2026-11-11 は水曜日
const NOW = new Date(2026, 10, 11, 10, 0, 0);

let seq = 0;
const newId = () => `id${++seq}`;

function todo(title: string, extra: Partial<Todo> = {}): Todo {
  return { id: newId(), title, done: false, createdAt: ++seq, ...extra };
}

describe('parseCommand', () => {
  it('語尾に操作がなければ追加になる', () => {
    expect(parseCommand('牛乳を買う', NOW)).toEqual({ type: 'add', title: '牛乳を買う' });
  });

  it('「〜を追加」は語尾を取り除いて追加する', () => {
    expect(parseCommand('牛乳を買うを追加して', NOW)).toEqual({ type: 'add', title: '牛乳を買う' });
    expect(parseCommand('追加 レポートを書く。', NOW)).toEqual({ type: 'add', title: 'レポートを書く' });
  });

  it('「追加」を付ければ操作の語尾を含むタスクも追加できる', () => {
    expect(parseCommand('部屋の電気を消すを追加', NOW)).toEqual({ type: 'add', title: '部屋の電気を消す' });
  });

  it('完了・削除・未完了を判別する', () => {
    expect(parseCommand('牛乳を買うを完了', NOW)).toEqual({
      type: 'complete',
      target: { kind: 'query', query: '牛乳を買う' },
    });
    expect(parseCommand('洗濯 終わった', NOW)).toEqual({
      type: 'complete',
      target: { kind: 'query', query: '洗濯' },
    });
    expect(parseCommand('牛乳を削除してください', NOW)).toEqual({
      type: 'delete',
      target: { kind: 'query', query: '牛乳' },
    });
    expect(parseCommand('洗濯を未完了に戻して', NOW)).toEqual({
      type: 'uncomplete',
      target: { kind: 'query', query: '洗濯' },
    });
  });

  it('番号で指定できる', () => {
    expect(parseCommand('2番を完了', NOW)).toEqual({ type: 'complete', target: { kind: 'index', index: 2 } });
    expect(parseCommand('三番目を消して', NOW)).toEqual({ type: 'delete', target: { kind: 'index', index: 3 } });
  });

  it('一括削除と取り消し', () => {
    expect(parseCommand('完了済みを全部削除', NOW)).toEqual({ type: 'clearCompleted' });
    expect(parseCommand('終わったものを消して', NOW)).toEqual({ type: 'clearCompleted' });
    expect(parseCommand('元に戻して', NOW)).toEqual({ type: 'undo' });
  });

  it('空の発話は何もしない', () => {
    expect(parseCommand('  。', NOW)).toEqual({ type: 'none' });
    expect(parseCommand('追加して', NOW)).toEqual({ type: 'none' });
  });
});

describe('parseAdd（期限）', () => {
  it('相対的な日付', () => {
    expect(parseAdd('明日までに牛乳を買う', NOW)).toEqual({ title: '牛乳を買う', due: '2026-11-12' });
    expect(parseAdd('牛乳を明後日買う', NOW)).toEqual({ title: '牛乳を買う', due: '2026-11-13' });
    expect(parseAdd('今日は洗濯する', NOW)).toEqual({ title: '洗濯する', due: '2026-11-11' });
    expect(parseAdd('3日後に歯医者', NOW)).toEqual({ title: '歯医者', due: '2026-11-14' });
  });

  it('月日の指定。過ぎた日付は次の月・年に送る', () => {
    expect(parseAdd('11月20日に会議の資料を作る', NOW)).toEqual({ title: '会議の資料を作る', due: '2026-11-20' });
    expect(parseAdd('5日に家賃を払う', NOW)).toEqual({ title: '家賃を払う', due: '2026-12-05' });
    expect(parseAdd('1月3日に初詣', NOW)).toEqual({ title: '初詣', due: '2027-01-03' });
  });

  it('曜日の指定', () => {
    expect(parseAdd('金曜日までにレポートを出す', NOW)).toEqual({ title: 'レポートを出す', due: '2026-11-13' });
    expect(parseAdd('水曜にゴミ出し', NOW)).toEqual({ title: 'ゴミ出し', due: '2026-11-18' });
    expect(parseAdd('来週の月曜に病院', NOW)).toEqual({ title: '病院', due: '2026-11-16' });
    expect(parseAdd('来週金曜に飲み会', NOW)).toEqual({ title: '飲み会', due: '2026-11-20' });
  });

  it('日数や存在しない日付は期限にしない', () => {
    expect(parseAdd('3日分の献立を考える', NOW)).toEqual({ title: '3日分の献立を考える' });
    expect(parseAdd('2月30日の件', NOW)).toEqual({ title: '2月30日の件' });
  });

  it('日付だけの発話はタイトルとして残す', () => {
    expect(parseAdd('明日', NOW)).toEqual({ title: '明日' });
  });
});

describe('similarity', () => {
  it('表記ゆれを吸収する', () => {
    expect(similarity('牛乳を買う', '牛乳を買う')).toBe(1);
    expect(similarity('レポートを書く', 'れぽーとを 書く')).toBe(1);
    expect(similarity('牛乳を買う', '牛乳')).toBeGreaterThan(0.8);
    expect(similarity('牛乳を買う', '洗濯')).toBe(0);
  });
});

describe('execute', () => {
  it('追加して期限順に並ぶ', () => {
    let todos: Todo[] = [];
    todos = execute(todos, parseCommand('洗濯', NOW), NOW, newId).todos;
    todos = execute(todos, parseCommand('明日牛乳を買う', NOW), NOW, newId).todos;
    expect(sortActive(todos).map((t) => t.title)).toEqual(['牛乳を買う', '洗濯']);
  });

  it('あいまいな名前で完了にできる', () => {
    const todos = [todo('牛乳を買う'), todo('洗濯物を干す')];
    const r = execute(todos, parseCommand('洗濯物完了', NOW), NOW, newId);
    expect(r.changed).toBe(true);
    expect(r.todos.find((t) => t.title === '洗濯物を干す')?.done).toBe(true);
    expect(r.todos.find((t) => t.title === '牛乳を買う')?.done).toBe(false);
  });

  it('番号は未完了の表示順に対応する', () => {
    const todos = [todo('A'), todo('B', { due: '2026-11-12' }), todo('C', { done: true })];
    const r = execute(todos, parseCommand('1番を完了', NOW), NOW, newId);
    expect(r.todos.find((t) => t.title === 'B')?.done).toBe(true);
  });

  it('見つからなければ変更しない', () => {
    const todos = [todo('牛乳を買う')];
    const r = execute(todos, parseCommand('掃除を削除', NOW), NOW, newId);
    expect(r.changed).toBe(false);
    expect(r.todos).toBe(todos);
  });

  it('完了済みの一括削除と未完了への戻し', () => {
    const todos = [todo('A'), todo('B', { done: true })];
    expect(execute(todos, parseCommand('Bを未完了に戻して', NOW), NOW, newId).todos.every((t) => !t.done)).toBe(true);
    expect(execute(todos, { type: 'clearCompleted' }, NOW, newId).todos.map((t) => t.title)).toEqual(['A']);
  });
});
