import { useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export function Auth({ client }: { client: SupabaseClient }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res =
      mode === 'signin'
        ? await client.auth.signInWithPassword({ email, password })
        : await client.auth.signUp({ email, password });
    setBusy(false);
    if (res.error) setMsg(res.error.message);
    else if (mode === 'signup' && !res.data.session) setMsg('確認メールを送信しました。メール内のリンクを開いてからログインしてください。');
  };

  return (
    <div className="auth">
      <h1>マクロ管理</h1>
      <form className="card stack" onSubmit={submit}>
        <label>
          メールアドレス
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label>
          パスワード
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
        </label>
        <button className="primary" disabled={busy}>
          {mode === 'signin' ? 'ログイン' : '新規登録'}
        </button>
        {msg && <p className="muted small">{msg}</p>}
        <button type="button" className="link" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? 'アカウントを作成する' : 'ログイン画面に戻る'}
        </button>
      </form>
    </div>
  );
}
