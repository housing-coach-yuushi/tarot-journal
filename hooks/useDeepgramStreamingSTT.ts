'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseDeepgramStreamingSTTOptions {
  onEnd?: (transcript: string) => void;
  onError?: (error: string) => void;
}

const DEFAULT_SAMPLE_RATE = 16000;
const DEFAULT_MODEL = 'nova-2';
const DEFAULT_LANGUAGE = 'ja';

function downsampleBuffer(input: Float32Array, inputSampleRate: number, outputSampleRate: number): Float32Array {
  if (outputSampleRate === inputSampleRate) return input;
  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(input.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < input.length; i += 1) {
      accum += input[i];
      count += 1;
    }
    result[offsetResult] = accum / Math.max(1, count);
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

export function useDeepgramStreamingSTT(options: UseDeepgramStreamingSTTOptions = {}) {
  const { onEnd, onError } = options;

  const [isListening, setIsListening] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [debugStatus, setDebugStatus] = useState('init');

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const finalTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const isFinalizingRef = useRef(false);
  const isStartingRef = useRef(false);
  const onEndRef = useRef(onEnd);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const supported = !!(navigator.mediaDevices && window.WebSocket);
    setIsSupported(supported);
  }, []);

  const cleanupAudio = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
  }, []);

  const cleanupSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const resetTranscript = useCallback(() => {
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    setCurrentTranscript('');
  }, []);

  const getToken = useCallback(async (): Promise<string> => {
    const res = await fetch('/api/deepgram/token');
    if (!res.ok) {
      throw new Error('Deepgram token error');
    }
    const data = await res.json();
    return data.access_token as string;
  }, []);

  const finalize = useCallback(() => {
    const full = `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim();
    if (full) {
      onEndRef.current?.(full);
    }
    resetTranscript();
    isFinalizingRef.current = false;
  }, [resetTranscript]);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      setDebugStatus('未対応');
      return;
    }

    if (isListening || isStartingRef.current) return;

    isStartingRef.current = true;
    setDebugStatus('マイク取得中');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('AudioContext not supported');
      }
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      const gain = audioContext.createGain();
      gain.gain.value = 0;

      processor.onaudioprocess = (event) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const input = event.inputBuffer.getChannelData(0);
        const downsampled = downsampleBuffer(input, audioContext.sampleRate, DEFAULT_SAMPLE_RATE);
        const pcm = new Int16Array(downsampled.length);
        for (let i = 0; i < downsampled.length; i += 1) {
          const s = Math.max(-1, Math.min(1, downsampled[i]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        wsRef.current.send(pcm.buffer);
      };

      source.connect(processor);
      processor.connect(gain);
      gain.connect(audioContext.destination);

      setDebugStatus('接続中');

      const token = await getToken();
      const model = process.env.NEXT_PUBLIC_DEEPGRAM_STT_MODEL || DEFAULT_MODEL;
      const language = process.env.NEXT_PUBLIC_DEEPGRAM_STT_LANGUAGE || DEFAULT_LANGUAGE;
      const params = new URLSearchParams({
        model,
        language,
        encoding: 'linear16',
        sample_rate: String(DEFAULT_SAMPLE_RATE),
        channels: '1',
        interim_results: 'true',
        smart_format: 'true',
        punctuate: 'true',
        vad_events: 'true',
        endpointing: 'false',
      });

      const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params.toString()}`, ['token', token]);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        setIsListening(true);
        setDebugStatus('録音中 (Deepgram)');
        isStartingRef.current = false;
      };

      ws.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        try {
          const data = JSON.parse(event.data);
          if (data.type !== 'Results') return;
          const transcript = data.channel?.alternatives?.[0]?.transcript || '';
          if (!transcript) return;

          if (data.is_final) {
            finalTranscriptRef.current = `${finalTranscriptRef.current} ${transcript}`.trim();
            interimTranscriptRef.current = '';
            setCurrentTranscript(finalTranscriptRef.current);

            if (data.speech_final || data.from_finalize || isFinalizingRef.current) {
              finalize();
            }
          } else {
            interimTranscriptRef.current = transcript;
            setCurrentTranscript(`${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim());
          }
        } catch (error) {
          // ignore parse errors
        }
      };

      ws.onerror = (event) => {
        console.warn('[Deepgram STT] websocket error', event);
        onErrorRef.current?.('socket-error');
        setDebugStatus('変換エラー');
        isStartingRef.current = false;
      };

      ws.onclose = () => {
        setIsListening(false);
        cleanupAudio();
        cleanupSocket();
        if (isFinalizingRef.current) {
          finalize();
        }
        isStartingRef.current = false;
      };
    } catch (error) {
      console.warn('[Deepgram STT] start error', error);
      onErrorRef.current?.('token');
      setDebugStatus('変換エラー');
      isStartingRef.current = false;
      cleanupAudio();
      cleanupSocket();
    }
  }, [cleanupAudio, cleanupSocket, finalize, getToken, isListening, isSupported]);

  const stopAndSend = useCallback(() => {
    if (!wsRef.current) return;
    isFinalizingRef.current = true;
    try {
      wsRef.current.send(JSON.stringify({ type: 'Finalize' }));
    } catch {
      // ignore
    }
    window.setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    }, 1000);
    setDebugStatus('処理中...');
    setIsListening(false);
    cleanupAudio();
  }, [cleanupAudio]);

  const cancel = useCallback(() => {
    isFinalizingRef.current = false;
    resetTranscript();
    cleanupAudio();
    cleanupSocket();
    setIsListening(false);
    setDebugStatus('キャンセル');
  }, [cleanupAudio, cleanupSocket, resetTranscript]);

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
