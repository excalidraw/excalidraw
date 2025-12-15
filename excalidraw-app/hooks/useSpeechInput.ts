import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isDev } from '../lib/chat/config';

type SpeechRecognitionConstructor = new () => SpeechRecognition;

type SpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives?: number;
  abort?: () => void;
  onstart?: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEvent = {
  results: SpeechRecognitionResultList;
  resultIndex?: number;
};

type SpeechRecognitionResultList = {
  length: number;
  [index: number]: SpeechRecognitionResult;
};

type SpeechRecognitionResult = {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
};

type SpeechRecognitionAlternative = {
  transcript: string;
};

type SpeechRecognitionErrorEvent = {
  error: string;
  message?: string;
};

export type SpeechStatus = 'idle' | 'listening' | 'error';

export interface UseSpeechInputOptions {
  lang?: string;
  onFinal?: (text: string) => void;
  onInterim?: (text: string) => void;
  onError?: (event: SpeechRecognitionErrorEvent) => void;
  shouldAutoResume?: () => boolean;
}

export interface UseSpeechInputResult {
  supported: boolean;
  status: SpeechStatus;
  interim: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

const getRecognizer = (): SpeechRecognitionConstructor | null => {
  if (typeof window === 'undefined') return null;
  const AnyWindow = window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
  return AnyWindow.SpeechRecognition || AnyWindow.webkitSpeechRecognition || null;
};

const mapError = (error: string): string => {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Mic permission was denied by the browser. Check site permissions and that you are on https/localhost.';
    case 'no-speech':
      return 'No speech detected.';
    case 'audio-capture':
      return 'No microphone found.';
    case 'aborted':
      return 'Voice input stopped.';
    default:
      return 'Voice input error.';
  }
};

const detachHandlers = (recognition: SpeechRecognition) => {
  recognition.onstart = null;
  recognition.onresult = null;
  recognition.onerror = null;
  recognition.onend = null;
};

export const useSpeechInput = (options: UseSpeechInputOptions = {}): UseSpeechInputResult => {
  const recognizerCtor = useMemo(() => getRecognizer(), []);
  const supported = Boolean(recognizerCtor);
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isActiveRef = useRef(false);
  const errorRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const sessionIdRef = useRef(0);

  const langRef = useRef(options.lang);
  const onFinalRef = useRef(options.onFinal);
  const onInterimRef = useRef(options.onInterim);
  const onErrorRef = useRef(options.onError);
  const shouldAutoResumeRef = useRef(options.shouldAutoResume);

  useEffect(() => {
    langRef.current = options.lang;
    onFinalRef.current = options.onFinal;
    onInterimRef.current = options.onInterim;
    onErrorRef.current = options.onError;
    shouldAutoResumeRef.current = options.shouldAutoResume;
  }, [options.lang, options.onFinal, options.onInterim, options.onError, options.shouldAutoResume]);

  const logDebug = useCallback((...args: unknown[]) => {
    if (!isDev()) return;
    // eslint-disable-next-line no-console
    console.warn(...args);
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    stopRequestedRef.current = true;
    isActiveRef.current = false;

    if (recognition) {
      try {
        // Prefer `stop()` so the recognizer can flush a final result.
        recognition.stop();
        // Fallback in case it never ends (some implementations can get stuck).
        setTimeout(() => {
          if (recognitionRef.current !== recognition) return;
          try {
            detachHandlers(recognition);
            recognition.abort?.();
          } catch (_) {
            // ignore
          }
          recognitionRef.current = null;
        }, 1500);
      } catch (_) {
        try {
          detachHandlers(recognition);
          if (recognition.abort) {
            recognition.abort();
          } else {
            recognition.stop();
          }
        } catch (_) {
          // ignore
        }
        recognitionRef.current = null;
      }
    }
    isActiveRef.current = false;
    setStatus('idle');
  }, []);

  const reset = useCallback(() => {
    sessionIdRef.current += 1;
    stop();
    setInterim('');
    setError(null);
    setStatus('idle');
    errorRef.current = false;
    stopRequestedRef.current = false;
  }, [stop]);

  const ensureMicPermission = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return true;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch (err) {
      errorRef.current = true;
      const name = err && typeof err === 'object' ? ((err as any).name as string | undefined) : undefined;
      const msg =
        err && typeof err === 'object'
          ? `${(err as any).name || 'Error'}${(err as any).message ? `: ${(err as any).message}` : ''}`
          : 'Mic permission error';
      logDebug('[SpeechInput] getUserMedia failed', err);
      // If no device is found, allow SpeechRecognition to proceed; some browsers still work.
      if (name && name.toLowerCase().includes('notfound')) {
        return true;
      }
      setError(`Mic access failed (${msg}). Check browser permissions and that the page is served from https or localhost.`);
      setStatus('error');
      return false;
    }
  }, [logDebug]);

  const start = useCallback(async () => {
    if (!recognizerCtor) return;
    if (isActiveRef.current) return;
    if (recognitionRef.current) return;
    try {
      errorRef.current = false;
      stopRequestedRef.current = false;
      const sessionId = sessionIdRef.current + 1;
      sessionIdRef.current = sessionId;
      const permissionOk = await ensureMicPermission();
      if (!permissionOk) {
        return;
      }
      const recognition = new recognizerCtor();
      const resolvedLang = langRef.current || (typeof navigator !== 'undefined' ? navigator.language : undefined) || 'en-US';
      recognition.lang = resolvedLang;
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;

      let processedResults = 0;
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (sessionIdRef.current !== sessionId) return;
        let interimTranscript = '';
        let finalTranscript = '';
        const startIndex = typeof event.resultIndex === 'number' ? event.resultIndex : processedResults;
        for (let i = startIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          if (result.isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript = transcript; // keep only the latest interim
          }
        }
        processedResults = event.results.length;
        setInterim(interimTranscript);
        if (interimTranscript && onInterimRef.current) {
          onInterimRef.current(interimTranscript);
        }
        if (finalTranscript) {
          onFinalRef.current?.(finalTranscript);
        }
      };

      recognition.onstart = () => {
        if (sessionIdRef.current !== sessionId) return;
        logDebug('[SpeechInput] onstart', { lang: recognition.lang });
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (sessionIdRef.current !== sessionId) return;
        onErrorRef.current?.(event);
        if (event.error === 'aborted' && stopRequestedRef.current) {
          // User-initiated stop; ignore.
          return;
        }
        errorRef.current = true;
        setError(mapError(event.error));
        setStatus('error');
        isActiveRef.current = false;
        logDebug('[SpeechInput] onerror', { error: event.error, message: event.message, stopRequested: stopRequestedRef.current });
      };

      recognition.onend = () => {
        if (sessionIdRef.current !== sessionId) return;
        isActiveRef.current = false;
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null;
        }
        if (stopRequestedRef.current) {
          setStatus('idle');
          logDebug('[SpeechInput] onend (stop requested)');
          return;
        }
        if (errorRef.current) {
          setStatus('error');
          logDebug('[SpeechInput] onend (error)');
          return;
        }
        const wantsResume = shouldAutoResumeRef.current?.() === true;
        if (wantsResume) {
          logDebug('[SpeechInput] onend (auto-resume scheduling)');
          setTimeout(() => {
            if (!isActiveRef.current && shouldAutoResumeRef.current?.() === true) {
              logDebug('[SpeechInput] auto-resume start()');
              start();
            }
          }, 50);
          return;
        }
        logDebug('[SpeechInput] onend (idle)');
        setStatus((prev) => (prev === 'listening' ? 'idle' : prev));
      };

      recognitionRef.current = recognition;
      isActiveRef.current = true;
      setStatus('listening');
      setError(null);

      try {
        recognition.start();
      } catch (err) {
        detachHandlers(recognition);
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null;
        }
        isActiveRef.current = false;
        setError('Voice input error.');
        setStatus('error');
      }
    } catch (err) {
      setError('Voice input error.');
      setStatus('error');
    }
  }, [recognizerCtor, ensureMicPermission, logDebug]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    supported,
    status,
    interim,
    error,
    start,
    stop,
    reset
  };
};
