import { useCallback, useEffect, useState, type MutableRefObject } from 'react';
import { getApiKey } from '../lib/ai';
import { requestPlan } from './ai';
import { cachedToken, deleteEvent, getToken, insertBlock, listEvents, loadGis } from './gcal';
import { newId } from './id';
import { ymd, type Todo } from './parse';
import { buildPlan, type Block, type CalEvent, type Plan } from './planner';
import type { Settings } from './settings';
import { useSpeech } from './useSpeech';

const PLAN_KEY = 'voice-todo:plan';

interface Stored {
  plan: Plan;
  /** カレンダーに登録済みだが計画からは外れた予定。次の登録時に削除する */
  stale: string[];
}

function loadStored(today: string): Stored | null {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    const s = raw ? (JSON.parse(raw) as Stored) : null;
    return s && s.plan?.date === today ? s : null;
  } catch {
    return null;
  }
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

interface Props {
  todos: Todo[];
  todosRef: MutableRefObject<Todo[]>;
  addTodos: (added: Todo[]) => void;
  toggle: (id: string) => void;
  settings: Settings;
  openSettings: () => void;
}

type Busy = '' | 'calendar' | 'ai' | 'sync';

export function PlanView({ todos, todosRef, addTodos, toggle, settings, openSettings }: Props) {
  const today = ymd(new Date());
  const clientId = settings.googleClientId;

  const [stored, setStored] = useState<Stored | null>(() => loadStored(today));
  const [transcript, setTranscript] = useState('');
  const [instruction, setInstruction] = useState('');
  const [revising, setRevising] = useState(false);
  const [events, setEvents] = useState<CalEvent[] | null>(null);
  const [busy, setBusy] = useState<Busy>('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const plan = stored?.plan ?? null;

  const save = useCallback((next: Stored | null) => {
    setStored(next);
    if (next) localStorage.setItem(PLAN_KEY, JSON.stringify(next));
    else localStorage.removeItem(PLAN_KEY);
  }, []);

  // 発話は、修正の依頼中なら指示欄に、そうでなければやりたいことの欄に書き足す
  const onFinal = useCallback(
    (text: string) => {
      const append = (prev: string) => (prev.trim() ? `${prev.trim()}\n${text.trim()}` : text.trim());
      if (revising) setInstruction(append);
      else setTranscript(append);
    },
    [revising],
  );
  const speech = useSpeech({ onFinal, keepListening: true });

  const fetchEvents = useCallback(
    async (token: string) => setEvents(await listEvents(token, today)),
    [today],
  );

  useEffect(() => {
    if (!clientId) return;
    // ボタンを押した時点でログイン画面をすぐ開けるよう、先に読み込んでおく
    loadGis().catch(() => undefined);
    const token = cachedToken();
    if (token) fetchEvents(token).catch(() => undefined);
  }, [clientId, fetchEvents]);

  // このアプリが登録した予定は「既存の予定」から除く
  const ownIds = new Set([...(plan?.blocks.flatMap((b) => (b.eventId ? [b.eventId] : [])) ?? []), ...(stored?.stale ?? [])]);
  const others = events?.filter((e) => !ownIds.has(e.id)) ?? [];

  const guard = async (kind: Busy, fn: () => Promise<void>) => {
    setError('');
    setNote('');
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy('');
    }
  };

  const connect = () => guard('calendar', async () => fetchEvents(await getToken(clientId)));

  const makePlan = (revision: boolean) =>
    guard('ai', async () => {
      speech.stop();
      const now = new Date();
      const result = await requestPlan({
        date: today,
        now,
        transcript: revision ? '' : transcript,
        todos: todosRef.current,
        events: others,
        calendarLoaded: events !== null,
        prefs: settings,
        ...(revision && plan ? { previous: plan, instruction } : {}),
      });
      const built = buildPlan(result.raw, todosRef.current, others, today, now, newId);

      // 時刻と内容が変わらない枠は、カレンダー登録済みの状態を引き継ぐ
      const old = plan?.blocks.filter((b) => b.eventId) ?? [];
      const kept = new Set<string>();
      for (const b of built.plan.blocks) {
        const same = old.find(
          (o) => !kept.has(o.eventId!) && o.title === b.title && o.start === b.start && o.end === b.end,
        );
        if (same) {
          b.eventId = same.eventId;
          kept.add(same.eventId!);
        }
      }
      const stale = [
        ...(stored?.stale ?? []),
        ...old.filter((o) => !kept.has(o.eventId!)).map((o) => o.eventId!),
      ];

      if (built.newTodos.length) addTodos(built.newTodos);
      save({ plan: built.plan, stale });
      setTranscript('');
      setInstruction('');
      setRevising(false);
      setNote(
        `計画を作成しました（AI 利用料の目安: $${result.costUsd.toFixed(3)}）` +
          (stale.length ? `。カレンダーに登録済みの古い予定 ${stale.length} 件は、次の登録時に置き換えます` : ''),
      );
    });

  const pending = plan?.blocks.filter((b) => !b.eventId).length ?? 0;
  const staleCount = stored?.stale.length ?? 0;

  const sync = () =>
    guard('sync', async () => {
      if (!stored) return;
      const token = await getToken(clientId);
      // 途中で失敗しても、成功した分は保存しておく
      let current = stored;
      for (const id of stored.stale) {
        await deleteEvent(token, id);
        current = { ...current, stale: current.stale.filter((x) => x !== id) };
        save(current);
      }
      let added = 0;
      for (const b of stored.plan.blocks) {
        if (b.eventId) continue;
        const eventId = await insertBlock(token, today, b);
        current = {
          ...current,
          plan: { ...current.plan, blocks: current.plan.blocks.map((x) => (x.id === b.id ? { ...x, eventId } : x)) },
        };
        save(current);
        added++;
      }
      await fetchEvents(token);
      setNote(`Google カレンダーに ${added} 件を登録しました`);
    });

  const removeBlock = (b: Block) => {
    if (!stored) return;
    save({
      plan: { ...stored.plan, blocks: stored.plan.blocks.filter((x) => x.id !== b.id) },
      stale: b.eventId ? [...stored.stale, b.eventId] : stored.stale,
    });
  };

  const discard = () =>
    guard('sync', async () => {
      if (!stored) return;
      const registered = [...stored.stale, ...stored.plan.blocks.flatMap((b) => (b.eventId ? [b.eventId] : []))];
      if (registered.length) {
        const ok = window.confirm(
          `この計画から Google カレンダーに登録した予定が ${registered.length} 件あります。カレンダーからも削除しますか？\n（キャンセルすると、カレンダーの予定は残したまま計画だけ破棄します）`,
        );
        if (ok) {
          const token = await getToken(clientId);
          for (const id of registered) await deleteEvent(token, id);
          await fetchEvents(token);
        }
      } else if (!window.confirm('今日の計画を破棄しますか？（タスクはリストに残ります）')) {
        return;
      }
      save(null);
      setRevising(false);
    });

  const hasKey = !!getApiKey();
  const activeCount = todos.filter((t) => !t.done).length;
  const doneIds = new Set(todos.filter((t) => t.done).map((t) => t.id));
  const knownIds = new Set(todos.map((t) => t.id));

  const micButton = (
    <button
      className={speech.listening ? 'mic on' : 'mic'}
      onClick={speech.listening ? speech.stop : speech.start}
      disabled={!speech.supported || busy !== ''}
      aria-pressed={speech.listening}
      aria-label={speech.listening ? '聞き取りを止める' : '音声入力を始める'}
    >
      <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V22h2v-3.08A7 7 0 0 0 19 12h-2Z"
        />
      </svg>
    </button>
  );

  const calendarRow = !clientId ? (
    <p className="cal">
      Google カレンダー未設定のため、既存の予定は考慮されません。
      <button className="link" onClick={openSettings}>
        設定する
      </button>
    </p>
  ) : events === null ? (
    <p className="cal">
      Google カレンダー未接続。
      <button className="link" onClick={connect} disabled={busy !== ''}>
        {busy === 'calendar' ? '接続中…' : '接続して今日の予定を読み込む'}
      </button>
    </p>
  ) : (
    <p className="cal">
      今日の予定 {others.length} 件を読み込み済み。
      <button className="link" onClick={connect} disabled={busy !== ''}>
        再読み込み
      </button>
    </p>
  );

  const messages = (
    <>
      {!speech.supported && (
        <p className="notice">このブラウザは音声認識に対応していません。文字で入力してください。</p>
      )}
      {speech.error && <p className="notice error">{speech.error}</p>}
      {error && <p className="notice error">{error}</p>}
      {note && <p className="notice">{note}</p>}
    </>
  );

  if (!plan) {
    return (
      <main className="plan">
        <p className="lead">今日やりたいことを、思いつくまま話してください。</p>
        <div className="dictate">
          {micButton}
          <span className="interim">
            {speech.interim || (speech.listening ? '聞き取り中…（もう一度押すと止まります）' : '')}
          </span>
        </div>
        <textarea
          rows={6}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder={'例: 午前中に企画書を仕上げたい。15時に歯医者。あと牛乳を買って、できればジムにも行きたい'}
          aria-label="今日やりたいこと"
        />
        {activeCount > 0 && <p className="cal">リストの未完了タスク {activeCount} 件も計画に含めます。</p>}
        {calendarRow}
        {!hasKey && (
          <p className="cal">
            AI の APIキーが未設定です。
            <button className="link" onClick={openSettings}>
              設定する
            </button>
          </p>
        )}
        {messages}
        <button
          className="primary"
          onClick={() => makePlan(false)}
          disabled={busy !== '' || !hasKey || (!transcript.trim() && activeCount === 0)}
        >
          {busy === 'ai' ? 'AI が計画を作成中…' : 'AI に計画を立ててもらう'}
        </button>
      </main>
    );
  }

  const allDay = others.filter((e) => e.allDay);
  const rows = [
    ...others.filter((e) => !e.allDay).map((e) => ({ kind: 'event' as const, start: e.start, event: e })),
    ...plan.blocks.map((b) => ({ kind: 'block' as const, start: b.start, block: b })),
  ].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <main className="plan">
      {plan.comment && <p className="comment">{plan.comment}</p>}
      {allDay.length > 0 && <p className="cal">終日: {allDay.map((e) => e.title).join('、')}</p>}

      <ul className="timeline">
        {rows.map((r) =>
          r.kind === 'event' ? (
            <li key={`e-${r.event.id}`} className="event">
              <span className="time">
                {r.event.start}
                <br />
                {r.event.end}
              </span>
              <span className="title">{r.event.title}</span>
              <span className="tag">予定</span>
            </li>
          ) : (
            <li key={r.block.id} className={r.block.conflict ? 'block conflict' : 'block'}>
              <span className="time">
                {r.block.start}
                <br />
                {r.block.end}
              </span>
              {r.block.todoId && knownIds.has(r.block.todoId) ? (
                <label>
                  <input
                    type="checkbox"
                    checked={doneIds.has(r.block.todoId)}
                    onChange={() => toggle(r.block.todoId!)}
                  />
                  <span className={doneIds.has(r.block.todoId) ? 'title struck' : 'title'}>{r.block.title}</span>
                </label>
              ) : (
                <span className="title">{r.block.title}</span>
              )}
              {r.block.conflict && <span className="tag warn">重複</span>}
              {r.block.eventId && <span className="tag">登録済み</span>}
              <button className="icon" onClick={() => removeBlock(r.block)} aria-label={`${r.block.title} の枠を外す`}>
                ×
              </button>
            </li>
          ),
        )}
      </ul>
      {rows.length === 0 && <p className="empty">時間枠はありません。</p>}

      {plan.unscheduled.length > 0 && (
        <section className="unscheduled">
          <h2>今日は入れなかったもの</h2>
          <ul>
            {plan.unscheduled.map((u, i) => (
              <li key={i}>
                {u.title}
                <span> — {u.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {calendarRow}
      {messages}

      {clientId && (pending > 0 || staleCount > 0) && (
        <button className="primary" onClick={sync} disabled={busy !== ''}>
          {busy === 'sync'
            ? '登録中…'
            : `Google カレンダーに登録（追加 ${pending} 件${staleCount ? `・削除 ${staleCount} 件` : ''}）`}
        </button>
      )}

      {revising ? (
        <div className="revise">
          <div className="dictate">
            {micButton}
            <span className="interim">
              {speech.interim || (speech.listening ? '聞き取り中…' : '直したい点を話すか入力してください')}
            </span>
          </div>
          <textarea
            rows={3}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="例: ジムは夜にして。あと郵便局にも行きたい"
            aria-label="計画への修正指示"
          />
          <div className="row">
            <button className="primary" onClick={() => makePlan(true)} disabled={busy !== '' || !instruction.trim()}>
              {busy === 'ai' ? 'AI が修正中…' : 'この内容で組み直す'}
            </button>
            <button
              onClick={() => {
                speech.stop();
                setRevising(false);
              }}
              disabled={busy !== ''}
            >
              やめる
            </button>
          </div>
        </div>
      ) : (
        <div className="row">
          <button onClick={() => setRevising(true)} disabled={busy !== ''}>
            修正を頼む
          </button>
          <button onClick={discard} disabled={busy !== ''}>
            計画を破棄
          </button>
        </div>
      )}
    </main>
  );
}
