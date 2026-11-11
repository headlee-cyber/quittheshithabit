import type { PlanPrefs } from './planner';

const KEY = 'voice-todo:settings';

export interface Settings extends PlanPrefs {
  /** Google Cloud で発行した OAuth クライアント ID（秘密情報ではない） */
  googleClientId: string;
}

const DEFAULTS: Settings = { googleClientId: '', dayStart: '07:00', dayEnd: '22:00', prefs: '' };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}
