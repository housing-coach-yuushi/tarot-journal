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

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const { lang = 'ja-JP', onFinalResult } = options;

  const [isListening, setIsListening] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [debugStatus, setDebugStatus] = useState('init');

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');
  const manualStopRef = useRef<boolean>(false);
  const onFinalResultRef = useRef(onFinalResult);

  // Keep callback ref updated
  useEffect(() => {
    onFinalResultRef.current = onFinalResult;
  }, [onFinalResult]);

  // Check browser support and setup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setIsSupported(!!SpeechRecognition);

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = lang;
        recognition.continuous = false;  // Fixed for push-to-talk reliability
        recognition.interimResults = true;

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let fullTranscript = '';

          // Collect all results
          for (let i = 0; i < event.results.length; i++) {
            fullTranscript += event.results[i][0].transcript;
          }

          console.log('[STT] Result:', fullTranscript);
          transcriptRef.current = fullTranscript;
          setCurrentTranscript(fullTranscript);
        };

        recognition.onaudiostart = () => {
          console.log('[STT] Audio started - microphone is capturing');
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
          console.log('[STT] onend - manualStop:', manualStopRef.current, 'transcript:', transcriptRef.current);
          setDebugStatus('終了: ' + (manualStopRef.current ? '送信' : 'キャンセル'));
          setIsListening(false);

          // Only send if manually stopped and has content
          if (manualStopRef.current && transcriptRef.current.trim()) {
            console.log('[STT] Calling onFinalResult with:', transcriptRef.current.trim());
            onFinalResultRef.current?.(transcriptRef.current.trim());
          }

          // Reset
          transcriptRef.current = '';
          manualStopRef.current = false;
        };

        recognition.onerror = (event: any) => {
          console.error('[STT] Error:', event.error, event);
          setDebugStatus('エラー: ' + event.error);
          setIsListening(false);
          transcriptRef.current = '';
          manualStopRef.current = false;
        };

        recognitionRef.current = recognition;
      }
    }
  }, [lang]);  // onFinalResult is handled via ref

  // Start listening (press down)
  const startListening = useCallback(() => {
    // Reset state first
    transcriptRef.current = '';
    setCurrentTranscript('');
    manualStopRef.current = false;

    // Set listening immediately for UI feedback (red button)
    setIsListening(true);
    setDebugStatus('録音中');

    if (recognitionRef.current) {
      // Small delay to ensure previous session is fully stopped
      setTimeout(() => {
        try {
          console.log('[STT] Starting recognition...');
          recognitionRef.current.start();
          console.log('[STT] Recognition started');
        } catch (error: any) {
          console.error('[STT] Failed to start:', error);
          setDebugStatus('エラー: ' + error.message);
        }
      }, 50);
    }
  }, []);

  // Stop listening and send (release)
  const stopAndSend = useCallback(() => {
    console.log('[STT] stopAndSend called, transcript:', transcriptRef.current);
    setDebugStatus('停止中...');

    // Set manual stop flag BEFORE stopping recognition
    manualStopRef.current = true;

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
    setCurrentTranscript('');
  }, []);

  // Cancel without sending
  const cancel = useCallback(() => {
    if (recognitionRef.current && isListening) {
      manualStopRef.current = false;  // Don't send
      recognitionRef.current.stop();
    }
    transcriptRef.current = '';
    setCurrentTranscript('');
  }, [isListening]);

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
