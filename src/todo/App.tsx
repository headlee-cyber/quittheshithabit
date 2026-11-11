import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { execute, parseAdd, parseCommand, sortActive, ymd, type Command, type Todo } from './parse';
import { useSpeech } from './useSpeech';

const STORAGE_KEY = 'voice-todo:v1';
const KEEP_KEY = 'voice-todo:keep-listening';

function loadTodos(): Todo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Todo[]) : [];
  } catch {
    return [];
  }
}

function newId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function dueLabel(due: string, today: string): { text: string; overdue: boolean } {
  const [y, m, d] = due.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const now = new Date();
  const tomorrow = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  if (due === today) return { text: '今日', overdue: false };
  if (due === tomorrow) return { text: '明日', overdue: false };
  return { text: `${m}/${d}(${'日月火水木金土'[date.getDay()]})`, overdue: due < today };
}

interface Feedback {
  heard?: string;
  message: string;
  ok: boolean;
}

export function App() {
  const [todos, setTodos] = useState<Todo[]>(loadTodos);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [draft, setDraft] = useState('');
  const [keepListening, setKeepListening] = useState(() => localStorage.getItem(KEEP_KEY) === '1');

  // 音声コールバックから常に最新の状態を参照するため ref にも持つ
  const todosRef = useRef(todos);
  const undoRef = useRef<Todo[] | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }, [todos]);
  useEffect(() => {
    localStorage.setItem(KEEP_KEY, keepListening ? '1' : '0');
  }, [keepListening]);

  const commit = useCallback((next: Todo[]) => {
    undoRef.current = todosRef.current;
    todosRef.current = next;
    setTodos(next);
    setCanUndo(true);
  }, []);

  const run = useCallback(
    (cmd: Command, heard?: string) => {
      if (cmd.type === 'undo') {
        const prev = undoRef.current;
        if (!prev) {
          setFeedback({ heard, message: '取り消せる操作がありません', ok: false });
          return;
        }
        undoRef.current = null;
        todosRef.current = prev;
        setTodos(prev);
        setCanUndo(false);
        setFeedback({ heard, message: '直前の操作を取り消しました', ok: true });
        return;
      }
      const result = execute(todosRef.current, cmd, new Date(), newId);
      if (result.changed) commit(result.todos);
      setFeedback({ heard, message: result.message, ok: result.changed });
    },
    [commit],
  );

  const onFinal = useCallback(
    (text: string) => run(parseCommand(text, new Date()), text.trim()),
    [run],
  );
  const speech = useSpeech({ onFinal, keepListening });

  const submitDraft = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    // 手入力は常に「追加」として扱う（期限の表現だけ解釈する）
    run({ type: 'add', ...parseAdd(draft, new Date()) });
    setDraft('');
  };

  const toggle = (t: Todo) =>
    commit(todosRef.current.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
  const remove = (t: Todo) => commit(todosRef.current.filter((x) => x.id !== t.id));

  const today = ymd(new Date());
  const active = sortActive(todos);
  const done = todos.filter((t) => t.done);

  return (
    <div className="app">
      <header>
        <h1>音声 To Do</h1>
        <span className="count">残り {active.length} 件</span>
      </header>

      <form className="add" onSubmit={submitDraft}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="手入力で追加（例: 明日 牛乳を買う）"
          aria-label="タスクを手入力で追加"
        />
        <button type="submit" disabled={!draft.trim()}>
          追加
        </button>
      </form>

      {!speech.supported && (
        <p className="notice">
          このブラウザは音声認識（Web Speech API）に対応していません。Chrome / Edge / Safari
          で開くか、手入力で利用してください。
        </p>
      )}
      {speech.error && <p className="notice error">{speech.error}</p>}

      <main>
        {todos.length === 0 && (
          <p className="empty">
            タスクはありません。
            <br />
            下のマイクを押して「牛乳を買う」のように話すと追加されます。
          </p>
        )}

        <ol className="list">
          {active.map((t, i) => {
            const due = t.due ? dueLabel(t.due, today) : null;
            return (
              <li key={t.id}>
                <span className="num">{i + 1}</span>
                <label>
                  <input type="checkbox" checked={false} onChange={() => toggle(t)} />
                  <span className="title">{t.title}</span>
                </label>
                {due && <span className={due.overdue ? 'due overdue' : 'due'}>{due.text}</span>}
                <button className="icon" onClick={() => remove(t)} aria-label={`${t.title} を削除`}>
                  ×
                </button>
              </li>
            );
          })}
        </ol>

        {done.length > 0 && (
          <section className="done">
            <div className="done-head">
              <h2>完了済み {done.length} 件</h2>
              <button className="link" onClick={() => run({ type: 'clearCompleted' })}>
                すべて削除
              </button>
            </div>
            <ul className="list">
              {done.map((t) => (
                <li key={t.id}>
                  <label>
                    <input type="checkbox" checked onChange={() => toggle(t)} />
                    <span className="title">{t.title}</span>
                  </label>
                  <button className="icon" onClick={() => remove(t)} aria-label={`${t.title} を削除`}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <details className="help">
          <summary>話し方の例</summary>
          <table>
            <tbody>
              <tr>
                <th>追加</th>
                <td>「牛乳を買う」「明日までにレポートを出すを追加」</td>
              </tr>
              <tr>
                <th>期限</th>
                <td>今日 / 明日 / 明後日 / 3日後 / 金曜 / 来週の月曜 / 11月20日</td>
              </tr>
              <tr>
                <th>完了</th>
                <td>「牛乳を完了」「洗濯終わった」「2番を完了」</td>
              </tr>
              <tr>
                <th>戻す</th>
                <td>「牛乳を未完了に戻して」</td>
              </tr>
              <tr>
                <th>削除</th>
                <td>「牛乳を削除」「1番を消して」「完了済みを全部削除」</td>
              </tr>
              <tr>
                <th>取り消し</th>
                <td>「元に戻して」「取り消し」</td>
              </tr>
            </tbody>
          </table>
          <p>
            「消す」「完了」などで終わるタスクを追加したいときは、「部屋の電気を消すを追加」のように最後に「追加」を付けてください。
          </p>
          <label className="toggle">
            <input
              type="checkbox"
              checked={keepListening}
              onChange={(e) => setKeepListening(e.target.checked)}
            />
            止めるまで連続で聞き取る
          </label>
        </details>
      </main>

      <footer>
        <div className="status" aria-live="polite">
          {speech.interim ? (
            <span className="interim">{speech.interim}</span>
          ) : speech.listening && !feedback ? (
            <span className="interim">聞き取り中…</span>
          ) : feedback ? (
            <>
              {feedback.heard && <span className="heard">「{feedback.heard}」</span>}
              <span className={feedback.ok ? 'result' : 'result ng'}>{feedback.message}</span>
            </>
          ) : (
            <span className="hint">マイクを押して話してください</span>
          )}
        </div>
        <div className="controls">
          <button className="undo" onClick={() => run({ type: 'undo' })} disabled={!canUndo}>
            取り消し
          </button>
          <button
            className={speech.listening ? 'mic on' : 'mic'}
            onClick={speech.listening ? speech.stop : speech.start}
            disabled={!speech.supported}
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
          <span className="spacer" />
        </div>
      </footer>
    </div>
  );
}
