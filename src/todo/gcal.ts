// Google カレンダー連携。サーバーを置かず、Google Identity Services のトークンフローでブラウザから直接呼ぶ。
import { hhmm, type Block, type CalEvent } from './planner';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const API = 'https://www.googleapis.com/calendar/v3';
const SCOPE =
  'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly';
const TOKEN_KEY = 'voice-todo:gcal-token';

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}
interface Gis {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (r: TokenResponse) => void;
        error_callback?: (e: { type: string }) => void;
      }): { requestAccessToken(options?: { prompt?: string }): void };
    };
  };
}

function gis(): Gis | undefined {
  return (window as unknown as { google?: Gis }).google;
}

let gisLoading: Promise<void> | null = null;

/** Google のログイン用スクリプトを読み込む。ポップアップがブロックされないよう、ボタンを押す前に呼んでおく */
export function loadGis(): Promise<void> {
  if (gis()?.accounts) return Promise.resolve();
  gisLoading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisLoading = null;
      reject(new Error('Google のログイン機能を読み込めませんでした。通信状況を確認してください。'));
    };
    document.head.appendChild(s);
  });
  return gisLoading;
}

/** 有効期限内のアクセストークンがあれば返す（約1時間で失効する。タブを閉じると消える） */
export function cachedToken(): string | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const { token, exp } = JSON.parse(raw) as { token: string; exp: number };
    return Date.now() < exp ? token : null;
  } catch {
    return null;
  }
}

function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

/** アクセストークンを取得する。必要なら Google の同意画面（ポップアップ）を開く */
export async function getToken(clientId: string): Promise<string> {
  const cached = cachedToken();
  if (cached) return cached;
  await loadGis();
  const g = gis();
  if (!g) throw new Error('Google のログイン機能を利用できません。');
  return new Promise<string>((resolve, reject) => {
    const client = g.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (r) => {
        if (!r.access_token) {
          reject(new Error(`Google の認証に失敗しました: ${r.error_description ?? r.error ?? '不明なエラー'}`));
          return;
        }
        const exp = Date.now() + ((r.expires_in ?? 3600) - 60) * 1000;
        sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token: r.access_token, exp }));
        resolve(r.access_token);
      },
      error_callback: (e) =>
        reject(
          new Error(
            e.type === 'popup_failed_to_open'
              ? 'ログイン画面を開けませんでした。ポップアップを許可してください。'
              : 'Google へのログインが完了しませんでした。',
          ),
        ),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

async function call<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new Error('Google カレンダーに接続できませんでした。通信状況を確認してください。');
  }
  if (res.status === 401) {
    clearToken();
    throw new Error('Google の認証が切れました。もう一度接続してください。');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(`Google カレンダーのエラー (${res.status}): ${body?.error?.message ?? res.statusText}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

interface GEvent {
  id: string;
  status?: string;
  summary?: string;
  transparency?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  attendees?: { self?: boolean; responseStatus?: string }[];
}

function dayRange(date: string): { start: Date; end: Date } {
  const [y, m, d] = date.split('-').map(Number);
  return { start: new Date(y, m - 1, d), end: new Date(y, m - 1, d + 1) };
}

/**
 * 指定日の予定を、表示中のすべてのカレンダーから取得する。
 * 辞退した予定と「予定なし（空き時間）」扱いの予定は除く。
 */
export async function listEvents(token: string, date: string): Promise<CalEvent[]> {
  const { start, end } = dayRange(date);
  const cals = await call<{ items?: { id: string; selected?: boolean }[] }>(
    token,
    '/users/me/calendarList?minAccessRole=reader&maxResults=250',
  );
  const ids = (cals.items ?? []).filter((c) => c.selected).map((c) => c.id);

  const query = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });
  const lists = await Promise.all(
    ids.map((id) =>
      call<{ items?: GEvent[] }>(token, `/calendars/${encodeURIComponent(id)}/events?${query}`).then(
        (r) => r.items ?? [],
      ),
    ),
  );

  const seen = new Set<string>();
  const out: CalEvent[] = [];
  for (const ev of lists.flat()) {
    if (seen.has(ev.id) || ev.status === 'cancelled' || ev.transparency === 'transparent') continue;
    if (ev.attendees?.some((a) => a.self && a.responseStatus === 'declined')) continue;
    seen.add(ev.id);
    const title = ev.summary?.trim() || '（タイトルなし）';
    if (ev.start?.dateTime && ev.end?.dateTime) {
      // 日をまたぐ予定は当日の範囲に切り詰める
      const s = new Date(Math.max(new Date(ev.start.dateTime).getTime(), start.getTime()));
      const e = new Date(ev.end.dateTime);
      out.push({ id: ev.id, title, start: hhmm(s), end: e >= end ? '23:59' : hhmm(e), allDay: false });
    } else {
      out.push({ id: ev.id, title, start: '00:00', end: '23:59', allDay: true });
    }
  }
  return out.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start));
}

/** 時間枠をメインのカレンダーに予定として登録し、イベント ID を返す */
export async function insertBlock(token: string, date: string, block: Block): Promise<string> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const ev = await call<{ id: string }>(token, '/calendars/primary/events', {
    method: 'POST',
    body: JSON.stringify({
      summary: block.title,
      description: '音声 To Do の計画から登録',
      start: { dateTime: `${date}T${block.start}:00`, timeZone },
      end: { dateTime: `${date}T${block.end}:00`, timeZone },
    }),
  });
  return ev.id;
}

/** このアプリが登録した予定を削除する。すでに消されている場合は成功として扱う */
export async function deleteEvent(token: string, eventId: string): Promise<void> {
  try {
    await call<void>(token, `/calendars/primary/events/${encodeURIComponent(eventId)}`, { method: 'DELETE' });
  } catch (e) {
    if (e instanceof Error && /\((404|410)\)/.test(e.message)) return;
    throw e;
  }
}
