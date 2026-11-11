import { useCallback, useEffect, useRef, useState } from 'react';

// Web Speech API（SpeechRecognition）の最小限の型。ブラウザによっては webkit 接頭辞付きでのみ提供される。
interface RecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: { length: number; [index: number]: RecognitionResult };
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'マイクの使用が許可されていません。ブラウザの設定でマイクを許可してください。',
  'service-not-allowed': 'このブラウザでは音声認識サービスを利用できません。',
  'audio-capture': 'マイクが見つかりません。',
  network: '音声認識サービスに接続できません。通信状況を確認してください。',
  'language-not-supported': '日本語の音声認識に対応していません。',
};

interface Options {
  /** 確定した発話ごとに呼ばれる */
  onFinal: (text: string) => void;
  /** true のあいだは、発話が終わっても聞き取りを自動で再開する */
  keepListening: boolean;
}

export function useSpeech({ onFinal, keepListening }: Options) {
  const [supported] = useState(() => !!getCtor());
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');

  const recRef = useRef<Recognition | null>(null);
  const wantRef = useRef(false);
  const onFinalRef = useRef(onFinal);
  const keepRef = useRef(keepListening);
  onFinalRef.current = onFinal;
  keepRef.current = keepListening;

  const begin = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = 'ja-JP';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let pending = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onFinalRef.current(r[0].transcript);
        else pending += r[0].transcript;
      }
      setInterim(pending);
    };
    rec.onerror = (e) => {
      // 無音・自分で止めた場合はエラー扱いにしない
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      wantRef.current = false;
      setError(ERROR_MESSAGES[e.error] ?? `音声認識エラー: ${e.error}`);
    };
    rec.onend = () => {
      setInterim('');
      if (recRef.current !== rec) return;
      if (wantRef.current && keepRef.current) {
        try {
          begin();
          return;
        } catch {
          // 再開できなければ停止として扱う
        }
      }
      wantRef.current = false;
      recRef.current = null;
      setListening(false);
    };

    recRef.current = rec;
    rec.start();
  }, []);

  const start = useCallback(() => {
    if (wantRef.current) return;
    setError('');
    wantRef.current = true;
    try {
      begin();
      setListening(true);
    } catch {
      wantRef.current = false;
      setError('音声認識を開始できませんでした。');
    }
  }, [begin]);

  const stop = useCallback(() => {
    wantRef.current = false;
    recRef.current?.stop();
  }, []);

  useEffect(
    () => () => {
      wantRef.current = false;
      const rec = recRef.current;
      recRef.current = null;
      rec?.abort();
    },
    [],
  );

  return { supported, listening, interim, error, start, stop };
}
