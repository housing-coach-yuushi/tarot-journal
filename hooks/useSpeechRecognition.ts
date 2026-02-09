'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseSpeechRecognitionOptions {
  lang?: string;
  onFinalResult?: (transcript: string) => void;  // Called when stopped with full transcript
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error?: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onaudiostart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const recognitionWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return recognitionWindow.SpeechRecognition || recognitionWindow.webkitSpeechRecognition;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const { lang = 'ja-JP', onFinalResult } = options;

  const [isListening, setIsListening] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isSupported] = useState(() => !!getSpeechRecognitionConstructor());
  const [debugStatus, setDebugStatus] = useState('init');

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptRef = useRef<string>('');
  const baseTranscriptRef = useRef<string>('');
  const sessionTranscriptRef = useRef<string>('');
  const manualStopRef = useRef<boolean>(false);
  const keepListeningRef = useRef<boolean>(false);
  const restartTimerRef = useRef<number | null>(null);
  const restartAttemptsRef = useRef<number>(0);
  const onFinalResultRef = useRef(onFinalResult);

  const joinTranscript = useCallback((base: string, session: string): string => {
    return `${base} ${session}`.replace(/\s+/g, ' ').trim();
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const commitSessionTranscript = useCallback(() => {
    const sessionText = sessionTranscriptRef.current.trim();
    if (!sessionText) return;
    const merged = joinTranscript(baseTranscriptRef.current, sessionText);
    baseTranscriptRef.current = merged;
    transcriptRef.current = merged;
    setCurrentTranscript(merged);
    sessionTranscriptRef.current = '';
  }, [joinTranscript]);

  const queueRestart = useCallback((delayMs: number) => {
    clearRestartTimer();
    const scheduleAttempt = (waitMs: number) => {
      restartTimerRef.current = window.setTimeout(() => {
        if (!keepListeningRef.current || manualStopRef.current) return;
        const recognition = recognitionRef.current;
        if (!recognition) return;
        try {
          recognition.start();
          restartAttemptsRef.current = 0;
          setIsListening(true);
          setDebugStatus('録音中');
        } catch (error) {
          restartAttemptsRef.current += 1;
          const nextWaitMs = Math.min(900, 120 + restartAttemptsRef.current * 140);
          console.warn('[STT] restart failed, retrying...', error);
          setDebugStatus('録音継続中');
          scheduleAttempt(nextWaitMs);
        }
      }, waitMs);
    };
    scheduleAttempt(delayMs);
  }, [clearRestartTimer]);

  const attachRecognitionHandlers = useCallback((recognition: SpeechRecognitionInstance) => {
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let sessionTranscript = '';

      // Collect all results
      for (let i = 0; i < event.results.length; i++) {
        sessionTranscript += event.results[i][0].transcript;
      }

      sessionTranscriptRef.current = sessionTranscript.trim();
      const mergedTranscript = joinTranscript(baseTranscriptRef.current, sessionTranscriptRef.current);
      transcriptRef.current = mergedTranscript;
      setCurrentTranscript(mergedTranscript);
    };

    recognition.onaudiostart = () => {
      console.log('[STT] Audio started');
      setDebugStatus('マイクON');
    };

    recognition.onspeechstart = () => {
      console.log('[STT] Speech detected');
      setDebugStatus('音声検出');
    };

    recognition.onspeechend = () => {
      console.log('[STT] Speech ended');
      setDebugStatus('音声終了');
    };

    recognition.onend = () => {
      console.log('[STT] onend - manualStop:', manualStopRef.current);
      if (!manualStopRef.current && keepListeningRef.current) {
        commitSessionTranscript();
        setDebugStatus('録音継続中');
        queueRestart(140);
        return;
      }
      clearRestartTimer();
      keepListeningRef.current = false;
      setDebugStatus('待機中');
      setIsListening(false);
      manualStopRef.current = false;
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[STT] Error:', event.error, event);
      const errorCode = String(event.error || 'unknown');
      if (
        keepListeningRef.current
        && !manualStopRef.current
        && (errorCode === 'aborted' || errorCode === 'no-speech')
      ) {
        setDebugStatus('録音継続中');
        return;
      }
      setDebugStatus('エラー: ' + event.error);
      keepListeningRef.current = false;
      clearRestartTimer();
      setIsListening(false);
      manualStopRef.current = false;
    };
  }, [clearRestartTimer, commitSessionTranscript, joinTranscript, queueRestart]);

  const createRecognition = useCallback((): SpeechRecognitionInstance | null => {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) return null;
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    attachRecognitionHandlers(recognition);
    recognitionRef.current = recognition;
    return recognition;
  }, [attachRecognitionHandlers, lang]);

  // Keep callback ref updated
  useEffect(() => {
    onFinalResultRef.current = onFinalResult;
  }, [onFinalResult]);

  // Check browser support and setup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      createRecognition();
    }
    return () => {
      clearRestartTimer();
      keepListeningRef.current = false;
      try {
        recognitionRef.current?.abort();
      } catch {
        // no-op
      }
    };
  }, [clearRestartTimer, createRecognition]);  // onFinalResult is handled via ref

  // Start listening (press down)
  const startListening = useCallback(() => {
    // Reset state first
    transcriptRef.current = '';
    baseTranscriptRef.current = '';
    sessionTranscriptRef.current = '';
    setCurrentTranscript('');
    manualStopRef.current = false;
    keepListeningRef.current = true;
    restartAttemptsRef.current = 0;
    clearRestartTimer();

    // Set listening immediately for UI feedback (red button)
    setIsListening(true);
    setDebugStatus('録音中');

    if (recognitionRef.current) {
      // Start immediately
      try {
        console.log('[STT] Starting recognition...');
        recognitionRef.current.start();
        console.log('[STT] Recognition started');
      } catch (error: unknown) {
        console.error('[STT] Failed to start immediately:', error);

        // If immediately starting fails (usually because it's still closing), 
        // retry once after a small delay
        setTimeout(() => {
          try {
            console.log('[STT] Retrying start...');
            recognitionRef.current?.start();
            console.log('[STT] Retry successful');
          } catch (retryError: unknown) {
            console.error('[STT] Retry failed:', retryError);
            // iOS Safari can keep a stale recognizer after repeated sessions.
            // Recreate one instance and retry once more.
            const newRecognition = createRecognition();
            if (newRecognition) {
              try {
                console.log('[STT] Rebuilding recognition instance...');
                newRecognition.start();
                console.log('[STT] Rebuild retry successful');
                return;
              } catch (rebuildError) {
                console.error('[STT] Rebuild retry failed:', rebuildError);
              }
            }
            if (keepListeningRef.current && !manualStopRef.current) {
              setDebugStatus('録音継続中');
              queueRestart(180);
              return;
            }
            const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
            setDebugStatus('エラー: ' + retryMessage);
            keepListeningRef.current = false;
            setIsListening(false);
          }
        }, 100);
      }
    }
  }, [clearRestartTimer, createRecognition, queueRestart]);

  // Stop listening and send (release)
  const stopAndSend = useCallback(() => {
    console.log('[STT] stopAndSend called, transcript:', transcriptRef.current);
    setDebugStatus('停止中...');

    // Set manual stop flag BEFORE stopping recognition
    keepListeningRef.current = false;
    manualStopRef.current = true;
    clearRestartTimer();
    commitSessionTranscript();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        console.log('[STT] recognition.stop() called');
      } catch (e) {
        // Already stopped
        console.warn('[STT] Stop error (likely already stopped):', e);
      }
    }

    setIsListening(false);

    // Get transcript before resetting
    const transcript = transcriptRef.current.trim();

    // Send immediately if we have content
    if (transcript) {
      setDebugStatus('送信: ' + transcript.substring(0, 20));
      onFinalResultRef.current?.(transcript);
    } else {
      setDebugStatus('空のため送信しない');
    }

    // Reset
    transcriptRef.current = '';
    baseTranscriptRef.current = '';
    sessionTranscriptRef.current = '';
    setCurrentTranscript('');
  }, [clearRestartTimer, commitSessionTranscript]);

  // Cancel without sending
  const cancel = useCallback(() => {
    keepListeningRef.current = false;
    clearRestartTimer();
    if (recognitionRef.current && isListening) {
      manualStopRef.current = false;  // Don't send
      recognitionRef.current.stop();
    }
    transcriptRef.current = '';
    baseTranscriptRef.current = '';
    sessionTranscriptRef.current = '';
    setCurrentTranscript('');
  }, [clearRestartTimer, isListening]);

  return {
    isListening,
    currentTranscript,
    isSupported,
    debugStatus,
    startListening,
    stopAndSend,
    cancel,
  };
}
