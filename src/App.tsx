import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { SEED_FOODS } from './data/seedFoods';
import { calcTargets } from './lib/nutrition';
import { localRepo } from './store/localRepo';
import type { Repo } from './store/repo';
import { createSupabaseRepo, supabase } from './store/supabaseRepo';
import type { Food, Profile } from './types';
import { Auth } from './components/Auth';
import { TodayView } from './components/TodayView';
import { WeightView } from './components/WeightView';
import { FoodsView } from './components/FoodsView';
import { SettingsView } from './components/SettingsView';

type Tab = 'today' | 'weight' | 'foods' | 'settings';
const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: '今日' },
  { id: 'weight', label: '体重' },
  { id: 'foods', label: '食品' },
  { id: 'settings', label: '設定' },
];

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!authReady) return <div className="center muted">読み込み中…</div>;
  if (supabase && !session) return <Auth client={supabase} />;

  const repo = supabase ? createSupabaseRepo(supabase) : localRepo;
  return <Main key={session?.user.id ?? 'local'} repo={repo} email={session?.user.email} />;
}

function Main({ repo, email }: { repo: Repo; email?: string }) {
  const [tab, setTab] = useState<Tab>('today');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userFoods, setUserFoods] = useState<Food[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadFoods = useCallback(async () => setUserFoods(await repo.listFoods()), [repo]);

  useEffect(() => {
    Promise.all([repo.getProfile(), repo.listFoods()])
      .then(([p, f]) => {
        setProfile(p);
        setUserFoods(f);
        if (!p) setTab('settings');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoaded(true));
  }, [repo]);

  const foods = useMemo(() => [...userFoods, ...SEED_FOODS], [userFoods]);
  const targets = profile ? calcTargets(profile) : null;

  const saveProfile = async (p: Profile) => {
    await repo.saveProfile(p);
    setProfile(p);
  };

  if (!loaded) return <div className="center muted">読み込み中…</div>;

  return (
    <div className="app">
      <main className="content">
        {error && <div className="error">{error}</div>}
        {tab === 'today' && <TodayView repo={repo} foods={foods} targets={targets} onNeedProfile={() => setTab('settings')} />}
        {tab === 'weight' && <WeightView repo={repo} profile={profile} onProfileChange={saveProfile} />}
        {tab === 'foods' && <FoodsView repo={repo} foods={foods} onChange={reloadFoods} />}
        {tab === 'settings' && <SettingsView profile={profile} onSave={saveProfile} repoKind={repo.kind} email={email} />}
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
