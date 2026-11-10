import { useCallback, useEffect, useMemo, useState } from 'react';
import { SEED_FOODS } from './data/seedFoods';
import { calcTargets } from './lib/nutrition';
import { localRepo as repo } from './store/localRepo';
import type { Food, Profile } from './types';
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
  const [tab, setTab] = useState<Tab>('today');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userFoods, setUserFoods] = useState<Food[]>([]);
  const [loaded, setLoaded] = useState(false);
  // バックアップ復元後にプロフィールと食品を読み直す
  const [dataVersion, setDataVersion] = useState(0);

  const reloadFoods = useCallback(async () => setUserFoods(await repo.listFoods()), []);

  useEffect(() => {
    Promise.all([repo.getProfile(), repo.listFoods()]).then(([p, f]) => {
      setProfile(p);
      setUserFoods(f);
      if (!p && dataVersion === 0) setTab('settings');
      setLoaded(true);
    });
  }, [dataVersion]);

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
        {tab === 'today' && (
          <TodayView
            repo={repo}
            foods={foods}
            targets={targets}
            onNeedProfile={() => setTab('settings')}
            onNeedKey={() => setTab('settings')}
          />
        )}
        {tab === 'weight' && <WeightView repo={repo} profile={profile} onProfileChange={saveProfile} />}
        {tab === 'foods' && <FoodsView repo={repo} foods={foods} onChange={reloadFoods} />}
        {tab === 'settings' && (
          <SettingsView profile={profile} onSave={saveProfile} onDataRestored={() => setDataVersion((v) => v + 1)} />
        )}
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
