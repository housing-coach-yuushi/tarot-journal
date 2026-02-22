'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface UseDeepgramStreamingSTTOptions {
  lang?: string;
  onFinalResult?: (transcript: string) => void;
  onEnd?: (transcript: string) => void;
  onError?: (error: string, detail?: string) => void;
}

type SttErrorCode = 'permission' | 'no-mic' | 'device-busy' | 'token' | 'ws' | 'unknown';

type DeepgramResultsMessage = {
  type?: string;
  channel?: {
    alternatives?: Array<{ transcript?: string }>;
  };
  is_final?: boolean;
  speech_final?: boolean;
};

type WebkitWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

const DG_SAMPLE_RATE = 16000;
const DG_CHANNELS = 1;

function getAudioContextCtor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as WebkitWindow;
  return window.AudioContext || w.webkitAudioContext;
}

function downsampleTo16k(float32: Float32Array, inputSampleRate: number): Int16Array {
  if (inputSampleRate <= DG_SAMPLE_RATE) {
    const out = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i += 1) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  const ratio = inputSampleRate / DG_SAMPLE_RATE;
  const outLength = Math.max(1, Math.floor(float32.length / ratio));
  const out = new Int16Array(outLength);
  let outIndex = 0;
  let inIndex = 0;

  while (outIndex < outLength) {
    const nextInIndex = Math.min(float32.length, Math.round((outIndex + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let i = Math.floor(inIndex); i < nextInIndex; i += 1) {
      sum += float32[i] || 0;
      count += 1;
    }
    const sample = count > 0 ? sum / count : 0;
    const clamped = Math.max(-1, Math.min(1, sample));
    out[outIndex] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    outIndex += 1;
    inIndex = nextInIndex;
  }

  return out;
}

function concatTranscript(finalText: string, interimText: string): string {
  return `${finalText} ${interimText}`.replace(/\s+/g, ' ').trim();
}

export function useDeepgramStreamingSTT(options: UseDeepgramStreamingSTTOptions = {}) {
  const { lang = 'ja-JP', onFinalResult, onEnd, onError } = options;

  const [isListening, setIsListening] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [finalizedTranscript, setFinalizedTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [inputLevel, setInputLevel] = useState(0);
  const [debugStatus, setDebugStatus] = useState('init');
  const [isSupported] = useState(() => !!(
    typeof window !== 'undefined' &&
    typeof window.WebSocket !== 'undefined' &&
    getAudioContextCtor() &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  ));

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const finalizeTimeoutRef = useRef<number | null>(null);
  const socketCloseFallbackTimerRef = useRef<number | null>(null);

  const finalTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const shouldSendOnStopRef = useRef(false);
  const stoppingRef = useRef(false);
  const sessionEndedRef = useRef(false);
  const inputLevelRef = useRef(0);

  const onFinalResultRef = useRef(onFinalResult);
  const onEndRef = useRef(onEnd);
  const onErrorRef = useRef(onError);

  const deepgramLang = useMemo(() => (lang || 'ja-JP').toLowerCase().startsWith('ja') ? 'ja' : 'ja', [lang]);

  useEffect(() => {
    onFinalResultRef.current = onFinalResult;
  }, [onFinalResult]);

  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const clearTimers = useCallback(() => {
    if (finalizeTimeoutRef.current !== null) {
      window.clearTimeout(finalizeTimeoutRef.current);
      finalizeTimeoutRef.current = null;
    }
    if (socketCloseFallbackTimerRef.current !== null) {
      window.clearTimeout(socketCloseFallbackTimerRef.current);
      socketCloseFallbackTimerRef.current = null;
    }
  }, []);

  const cleanupAudio = useCallback(() => {
    try {
      processorRef.current?.disconnect();
    } catch {
      // no-op
    }
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }

    try {
      sourceNodeRef.current?.disconnect();
    } catch {
      // no-op
    }
    sourceNodeRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      void ctx.close().catch(() => {});
    }
  }, []);

  const cleanupSocket = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (!ws) return;
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      try {
        ws.close();
      } catch {
        // no-op
      }
    }
  }, []);

  const resetSessionState = useCallback(() => {
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    inputLevelRef.current = 0;
    shouldSendOnStopRef.current = false;
    stoppingRef.current = false;
    sessionEndedRef.current = false;
    setCurrentTranscript('');
    setFinalizedTranscript('');
    setInterimTranscript('');
    setInputLevel(0);
  }, []);

  const emitFinalIfNeeded = useCallback((reason: 'send' | 'cancel' | 'error') => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;

    const merged = concatTranscript(finalTranscriptRef.current, interimTranscriptRef.current).trim();
    if (reason === 'send') {
      if (!merged) {
        setDebugStatus('音声が短すぎます');
        return;
      }
      setCurrentTranscript(merged);
      setDebugStatus('完了');
      onEndRef.current?.(merged);
      onFinalResultRef.current?.(merged);
      return;
    }

    if (reason === 'cancel') {
      setDebugStatus('キャンセル');
      setCurrentTranscript('');
      return;
    }

    setDebugStatus('変換エラー');
  }, []);

  const finishSession = useCallback((reason: 'send' | 'cancel' | 'error') => {
    clearTimers();
    cleanupAudio();
    cleanupSocket();
    setIsListening(false);
    inputLevelRef.current = 0;
    setInputLevel(0);
    emitFinalIfNeeded(reason);
  }, [cleanupAudio, cleanupSocket, clearTimers, emitFinalIfNeeded]);

  const fetchDeepgramToken = useCallback(async (): Promise<string> => {
    const response = await fetch('/api/deepgram/token', { cache: 'no-store' });
    const text = await response.text();
    let data: { access_token?: string; details?: string; error?: string } | null = null;
    try {
      data = text ? JSON.parse(text) as { access_token?: string; details?: string; error?: string } : null;
    } catch {
      // no-op
    }
    if (!response.ok || !data?.access_token) {
      const detail = data?.details || data?.error || text || `token ${response.status}`;
      throw new Error(String(detail));
    }
    return data.access_token as string;
  }, []);

  const handleWsMessage = useCallback((event: MessageEvent) => {
    let payload: DeepgramResultsMessage | null = null;
    try {
      payload = JSON.parse(String(event.data));
    } catch {
      return;
    }

    const transcript = payload?.channel?.alternatives?.[0]?.transcript?.trim?.() || '';
    const isFinal = Boolean(payload?.is_final);
    const speechFinal = Boolean(payload?.speech_final);

    if (payload?.type === 'Results') {
      if (isFinal) {
        if (transcript) {
          finalTranscriptRef.current = concatTranscript(finalTranscriptRef.current, transcript);
        }
        interimTranscriptRef.current = '';
        setFinalizedTranscript(finalTranscriptRef.current);
        setInterimTranscript('');
      } else {
        interimTranscriptRef.current = transcript;
        setInterimTranscript(transcript);
      }

      const merged = concatTranscript(finalTranscriptRef.current, interimTranscriptRef.current);
      setCurrentTranscript(merged);

      if (speechFinal && stoppingRef.current && shouldSendOnStopRef.current) {
        if (finalizeTimeoutRef.current !== null) {
          window.clearTimeout(finalizeTimeoutRef.current);
          finalizeTimeoutRef.current = null;
        }
      }
    }
  }, []);

  const openStreamingSession = useCallback(async () => {
    const token = await fetchDeepgramToken();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const AudioCtx = getAudioContextCtor();
    if (!AudioCtx) {
      throw new Error('AudioContext unsupported');
    }

    const audioContext = new AudioCtx();
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const url = new URL('wss://api.deepgram.com/v1/listen');
    url.searchParams.set('model', 'nova-3');
    url.searchParams.set('language', deepgramLang);
    url.searchParams.set('encoding', 'linear16');
    url.searchParams.set('sample_rate', String(DG_SAMPLE_RATE));
    url.searchParams.set('channels', String(DG_CHANNELS));
    url.searchParams.set('interim_results', 'true');
    url.searchParams.set('vad_events', 'true');
    url.searchParams.set('endpointing', '300');
    url.searchParams.set('smart_format', 'true');
    url.searchParams.set('punctuate', 'true');

    // Deepgram browser auth supports token subprotocol.
    const ws = new WebSocket(url.toString(), ['token', token]);
    ws.binaryType = 'arraybuffer';

    mediaStreamRef.current = stream;
    audioContextRef.current = audioContext;
    wsRef.current = ws;

    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    sourceNodeRef.current = source;
    processorRef.current = processor;

    source.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = (evt: AudioProcessingEvent) => {
      const socket = wsRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN || stoppingRef.current) return;
      const input = evt.inputBuffer.getChannelData(0);
      if (!input || input.length === 0) return;
      let sumSquares = 0;
      for (let i = 0; i < input.length; i += 1) {
        const s = input[i] || 0;
        sumSquares += s * s;
      }
      const rms = Math.sqrt(sumSquares / input.length);
      const normalized = Math.min(1, rms * 12);
      const smoothed = Math.max(normalized, inputLevelRef.current * 0.82);
      inputLevelRef.current = smoothed;
      setInputLevel(smoothed);
      const pcm16 = downsampleTo16k(input, audioContext.sampleRate);
      if (pcm16.byteLength > 0) {
        socket.send(pcm16.buffer);
      }
    };

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        fn();
      };

      const openTimer = window.setTimeout(() => {
        settle(() => reject(new Error('Deepgram websocket timeout')));
      }, 7000);

      ws.onopen = () => {
        window.clearTimeout(openTimer);
        setDebugStatus('録音中');
        settle(resolve);
      };

      ws.onerror = () => {
        window.clearTimeout(openTimer);
        settle(() => reject(new Error('Deepgram websocket error')));
      };

      ws.onmessage = handleWsMessage;

      ws.onclose = () => {
        window.clearTimeout(openTimer);
        if (!settled) {
          settle(() => reject(new Error('Deepgram websocket closed before ready')));
          return;
        }
        if (stoppingRef.current) {
          finishSession(shouldSendOnStopRef.current ? 'send' : 'cancel');
        } else if (!sessionEndedRef.current) {
          setDebugStatus('接続エラー');
          onErrorRef.current?.('ws', 'socket closed unexpectedly');
          finishSession('error');
        }
      };
    });
  }, [deepgramLang, fetchDeepgramToken, finishSession, handleWsMessage]);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      setDebugStatus('未対応');
      return;
    }
    if (isListening) return;

    resetSessionState();
    setDebugStatus('マイク取得中');
    setIsListening(true);

    try {
      await openStreamingSession();
    } catch (error) {
      cleanupAudio();
      cleanupSocket();
      setIsListening(false);

      let code: SttErrorCode = 'unknown';
      let status = '変換エラー';
      const message = error instanceof Error ? error.message : String(error);
      const lower = message.toLowerCase();

      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
          code = 'permission';
          status = 'マイク許可が必要です';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          code = 'no-mic';
          status = 'マイクが見つかりません';
        } else if (error.name === 'NotReadableError' || error.name === 'AbortError') {
          code = 'device-busy';
          status = 'マイク利用エラー';
        }
      } else if (lower.includes('token') || lower.includes('auth')) {
        code = 'token';
        status = 'トークン取得エラー';
      } else if (lower.includes('timeout')) {
        code = 'ws';
        status = '接続タイムアウト';
      } else if (lower.includes('websocket')) {
        code = 'ws';
        status = '接続エラー';
      }

      setDebugStatus(status);
      onErrorRef.current?.(code, message.slice(0, 240));
    }
  }, [cleanupAudio, cleanupSocket, isListening, isSupported, openStreamingSession, resetSessionState]);

  const stopAndSend = useCallback(() => {
    if (!isListening && !wsRef.current) {
      setDebugStatus('音声が短すぎます');
      return;
    }

    shouldSendOnStopRef.current = true;
    stoppingRef.current = true;
    setIsListening(false);
    setDebugStatus('処理中...');

    cleanupAudio();

    const ws = wsRef.current;
    if (!ws || ws.readyState === WebSocket.CLOSED) {
      finishSession('send');
      return;
    }

    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'Finalize' }));
      }
    } catch {
      // ignore and continue to close
    }

    finalizeTimeoutRef.current = window.setTimeout(() => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'CloseStream' }));
        } else {
          ws.close();
        }
      } catch {
        try {
          ws.close();
        } catch {
          // no-op
        }
      }
    }, 220);

    socketCloseFallbackTimerRef.current = window.setTimeout(() => {
      try {
        ws.close();
      } catch {
        // no-op
      }
    }, 1200);
  }, [cleanupAudio, finishSession, isListening]);

  const cancel = useCallback(() => {
    shouldSendOnStopRef.current = false;
    stoppingRef.current = true;
    setIsListening(false);
    clearTimers();
    cleanupAudio();
    finishSession('cancel');
  }, [cleanupAudio, clearTimers, finishSession]);

  useEffect(() => {
    return () => {
      clearTimers();
      cleanupAudio();
      cleanupSocket();
    };
  }, [cleanupAudio, cleanupSocket, clearTimers]);

  return {
    isListening,
    currentTranscript,
    finalizedTranscript,
    interimTranscript,
    inputLevel,
    isSupported,
    debugStatus,
    startListening,
    stopAndSend,
    cancel,
  };
}
