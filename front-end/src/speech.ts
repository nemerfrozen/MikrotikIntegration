const LANG = 'es-ES';
const AUTO_SPEAK_KEY = 'mikrotik-chat-auto-speak';

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

let recognition: SpeechRecognitionLike | null = null;

const getSpeechRecognitionConstructor = (): SpeechRecognitionConstructor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

export const isSpeechRecognitionSupported = () => Boolean(getSpeechRecognitionConstructor());

export const isSpeechSynthesisSupported = () =>
  typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';

export const loadAutoSpeak = (): boolean => {
  try {
    return localStorage.getItem(AUTO_SPEAK_KEY) === '1';
  } catch {
    return false;
  }
};

export const saveAutoSpeak = (enabled: boolean) => {
  try {
    localStorage.setItem(AUTO_SPEAK_KEY, enabled ? '1' : '0');
  } catch {
    // ignore
  }
};

export const stopSpeaking = () => {
  if (!isSpeechSynthesisSupported()) return;
  window.speechSynthesis.cancel();
};

export const speak = (
  text: string,
  options?: { onEnd?: () => void; onError?: () => void }
) => {
  if (!isSpeechSynthesisSupported() || !text.trim()) {
    options?.onEnd?.();
    return;
  }

  stopSpeaking();

  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = LANG;
  utterance.rate = 1;
  utterance.onend = () => options?.onEnd?.();
  utterance.onerror = () => options?.onError?.();

  window.speechSynthesis.speak(utterance);
};

/** Cancela sin disparar onEnd (cambio de chat, cleanup, reinicio). */
export const abortListening = () => {
  if (!recognition) return;
  try {
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognition.abort();
  } catch {
    // ignore
  }
  recognition = null;
};

/** Detiene el dictado y deja que onEnd se dispare (para auto-enviar). */
export const stopListening = () => {
  if (!recognition) return;
  try {
    recognition.stop();
  } catch {
    recognition = null;
  }
};

export const startListening = ({
  onResult,
  onError,
  onEnd,
}: {
  onResult: (text: string, isFinal: boolean) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
}) => {
  const Recognition = getSpeechRecognitionConstructor();
  if (!Recognition) {
    onError?.('Tu navegador no soporta reconocimiento de voz.');
    onEnd?.();
    return;
  }

  abortListening();
  stopSpeaking();

  const instance = new Recognition();
  instance.lang = LANG;
  instance.continuous = false;
  instance.interimResults = true;

  instance.onresult = (event) => {
    let transcript = '';
    for (let i = 0; i < event.results.length; i += 1) {
      transcript += event.results[i][0].transcript;
    }
    const last = event.results[event.results.length - 1];
    onResult(transcript.trim(), Boolean(last?.isFinal));
  };

  instance.onerror = (event) => {
    if (event.error === 'aborted') {
      return;
    }
    if (event.error === 'no-speech') {
      onError?.('No se detectó voz. Intenta de nuevo.');
      return;
    }
    onError?.(
      event.error === 'not-allowed'
        ? 'Permiso de micrófono denegado.'
        : `Error de voz: ${event.error}`
    );
  };

  instance.onend = () => {
    recognition = null;
    onEnd?.();
  };

  recognition = instance;
  instance.start();
};
