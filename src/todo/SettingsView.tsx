import { useState } from 'react';
import { getApiKey, MODEL, setApiKey } from '../lib/ai';
import type { Settings } from './settings';

interface Props {
  settings: Settings;
  onChange: (next: Settings) => void;
}

export function SettingsView({ settings, onChange }: Props) {
  const [keyInput, setKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(() => !!getApiKey());
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });

  return (
    <main className="settings">
      <section>
        <h2>一日の時間帯</h2>
        <div className="row">
          <label>
            開始
            <input type="time" value={settings.dayStart} onChange={(e) => set({ dayStart: e.target.value || '07:00' })} />
          </label>
          <label>
            終了
            <input type="time" value={settings.dayEnd} onChange={(e) => set({ dayEnd: e.target.value || '22:00' })} />
          </label>
        </div>
        <label className="block">
          スケジュールの好み（AI に毎回伝える内容）
          <textarea
            rows={4}
            value={settings.prefs}
            onChange={(e) => set({ prefs: e.target.value })}
            placeholder={'例:\n昼食は12時〜13時\n集中が必要な作業は午前中に\n18時以降は仕事を入れない'}
          />
        </label>
      </section>

      <section>
        <h2>AI（Anthropic APIキー）</h2>
        <p>
          計画の作成に Claude（{MODEL}）を使います。キーはこの端末のブラウザ内にだけ保存され、マクロ管理アプリと共用です。
        </p>
        {hasKey ? (
          <div className="row">
            <span className="ok">登録済み</span>
            <button
              onClick={() => {
                setApiKey('');
                setHasKey(false);
              }}
            >
              削除
            </button>
          </div>
        ) : (
          <div className="row">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sk-ant-..."
              autoComplete="off"
              aria-label="Anthropic APIキー"
            />
            <button
              disabled={!keyInput.trim()}
              onClick={() => {
                setApiKey(keyInput.trim());
                setHasKey(true);
                setKeyInput('');
              }}
            >
              保存
            </button>
          </div>
        )}
      </section>

      <section>
        <h2>Google カレンダー</h2>
        <p>
          Google Cloud で作成した OAuth クライアント ID（ウェブ アプリケーション）を入力します。作成手順は README
          にあります。クライアント ID は秘密情報ではありません。
        </p>
        <input
          value={settings.googleClientId}
          onChange={(e) => set({ googleClientId: e.target.value.trim() })}
          placeholder="xxxxxxxx.apps.googleusercontent.com"
          autoComplete="off"
          aria-label="Google OAuth クライアント ID"
        />
        <p>
          このページのオリジン（承認済みの JavaScript 生成元に登録する値）: <code>{location.origin}</code>
        </p>
      </section>
    </main>
  );
}
