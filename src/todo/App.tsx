import { useCallback, useEffect, useRef, useState } from 'react';
import { newId } from './id';
import { ListView } from './ListView';
import { execute, sortActive, type Command, type Todo } from './parse';
import { PlanView } from './PlanView';
import { loadSettings, saveSettings, type Settings } from './settings';
import { SettingsView } from './SettingsView';

const STORAGE_KEY = 'voice-todo:v1';

function loadTodos(): Todo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Todo[]) : [];
  } catch {
    return [];
  }
}

export interface Feedback {
  heard?: string;
  message: string;
  ok: boolean;
}

type Tab = 'plan' | 'list' | 'settings';
const TABS: { id: Tab; label: string }[] = [
  { id: 'plan', label: '今日の計画' },
  { id: 'list', label: 'リスト' },
  { id: 'settings', label: '設定' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('plan');
  const [todos, setTodos] = useState<Todo[]>(loadTodos);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);

  // 音声や非同期処理のコールバックから常に最新の状態を参照するため ref にも持つ
  const todosRef = useRef(todos);
  const undoRef = useRef<Todo[] | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }, [todos]);

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

  const toggle = useCallback(
    (id: string) => commit(todosRef.current.map((x) => (x.id === id ? { ...x, done: !x.done } : x))),
    [commit],
  );
  const remove = useCallback((id: string) => commit(todosRef.current.filter((x) => x.id !== id)), [commit]);
  const addTodos = useCallback((added: Todo[]) => commit([...todosRef.current, ...added]), [commit]);

  const updateSettings = (next: Settings) => {
    setSettings(next);
    saveSettings(next);
  };

  return (
    <div className="app">
      <header>
        <h1>音声 To Do</h1>
        <span className="count">残り {sortActive(todos).length} 件</span>
      </header>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'plan' && (
        <PlanView
          todos={todos}
          todosRef={todosRef}
          addTodos={addTodos}
          toggle={toggle}
          settings={settings}
          openSettings={() => setTab('settings')}
        />
      )}
      {tab === 'list' && (
        <ListView todos={todos} feedback={feedback} canUndo={canUndo} run={run} toggle={toggle} remove={remove} />
      )}
      {tab === 'settings' && <SettingsView settings={settings} onChange={updateSettings} />}
    </div>
  );
}
