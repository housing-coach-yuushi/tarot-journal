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

function floatToPcm16(float32: Float32Array): Int16Array {
  const pcm = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i += 1) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return pcm;
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
  const processorNodeRef = useRef<AudioWorkletNode | ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const finalTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const isFinalizingRef = useRef(false);
  const isStartingRef = useRef(false);
  const onEndRef = useRef(onEnd);
  const onErrorRef = useRef(onError);
  // Buffer PCM chunks while WebSocket is connecting
  const pendingChunksRef = useRef<ArrayBuffer[]>([]);
  const wsReadyRef = useRef(false);

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
    if (processorNodeRef.current) {
      try { processorNodeRef.current.disconnect(); } catch { /* ignore */ }
      if ('onaudioprocess' in processorNodeRef.current) {
        (processorNodeRef.current as ScriptProcessorNode).onaudioprocess = null;
      }
      if ('port' in processorNodeRef.current && processorNodeRef.current instanceof AudioWorkletNode) {
        try { processorNodeRef.current.port.close(); } catch { /* ignore */ }
      }
      processorNodeRef.current = null;
    }
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch { /* ignore */ }
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
    wsReadyRef.current = false;
    pendingChunksRef.current = [];
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      try { wsRef.current.close(); } catch { /* ignore */ }
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

  // Send a PCM buffer, or queue it if WebSocket isn't ready yet
  const sendPcm = useCallback((buffer: ArrayBuffer) => {
    if (wsReadyRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(buffer);
    } else {
      // Buffer up to ~5 seconds of audio at 16kHz 16bit mono = ~160KB/s
      if (pendingChunksRef.current.length < 200) {
        pendingChunksRef.current.push(buffer);
      }
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      setDebugStatus('未対応');
      return;
    }

    if (isStartingRef.current) return;
    // Use ref check to avoid stale closure issue with isListening state
    if (wsRef.current || mediaStreamRef.current) return;

    isStartingRef.current = true;
    isFinalizingRef.current = false;
    wsReadyRef.current = false;
    pendingChunksRef.current = [];
    setDebugStatus('マイク取得中');

    try {
      // 1) getUserMedia FIRST — must happen synchronously in user gesture on iOS
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
      const audioContext = new AudioContextClass({ sampleRate: DEFAULT_SAMPLE_RATE });
      audioContextRef.current = audioContext;
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // 2) Set up audio processor (AudioWorklet preferred, ScriptProcessor fallback)
      let processorSetUp = false;
      if (typeof audioContext.audioWorklet !== 'undefined') {
        try {
          const workletCode = `
class PcmSender extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0]?.[0];
    if (ch && ch.length > 0) this.port.postMessage(ch.buffer, [ch.buffer]);
    return true;
  }
}
registerProcessor('pcm-sender', PcmSender);
`;
          const blob = new Blob([workletCode], { type: 'application/javascript' });
          const blobUrl = URL.createObjectURL(blob);
          await audioContext.audioWorklet.addModule(blobUrl);
          URL.revokeObjectURL(blobUrl);

          const workletNode = new AudioWorkletNode(audioContext, 'pcm-sender');
          workletNode.port.onmessage = (e) => {
            const float32 = new Float32Array(e.data as ArrayBuffer);
            const downsampled = downsampleBuffer(float32, audioContext.sampleRate, DEFAULT_SAMPLE_RATE);
            const pcm = floatToPcm16(downsampled);
            sendPcm(pcm.buffer as ArrayBuffer);
          };
          source.connect(workletNode);
          workletNode.connect(audioContext.destination);
          processorNodeRef.current = workletNode;
          processorSetUp = true;
        } catch {
          // AudioWorklet failed, fall through to ScriptProcessor
        }
      }

      if (!processorSetUp) {
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        const gain = audioContext.createGain();
        gain.gain.value = 0;

        processor.onaudioprocess = (event) => {
          const input = event.inputBuffer.getChannelData(0);
          const downsampled = downsampleBuffer(input, audioContext.sampleRate, DEFAULT_SAMPLE_RATE);
          const pcm = floatToPcm16(downsampled);
          sendPcm(pcm.buffer as ArrayBuffer);
        };

        source.connect(processor);
        processor.connect(gain);
        gain.connect(audioContext.destination);
        processorNodeRef.current = processor;
      }

      // Mark as listening immediately — audio is capturing now
      setIsListening(true);
      setDebugStatus('録音中 (接続待ち)');

      // 3) Token + WebSocket — done in parallel with audio capture
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
        wsReadyRef.current = true;
        // Flush buffered audio chunks
        const buffered = pendingChunksRef.current;
        pendingChunksRef.current = [];
        for (const chunk of buffered) {
          try { ws.send(chunk); } catch { break; }
        }
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

            // Only finalize when user explicitly released the mic
            if (isFinalizingRef.current && (data.speech_final || data.from_finalize)) {
              finalize();
            }
          } else {
            interimTranscriptRef.current = transcript;
            setCurrentTranscript(`${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim());
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = (event) => {
        console.warn('[Deepgram STT] websocket error', event);
        setDebugStatus('変換エラー');
        isStartingRef.current = false;
        // Don't tear down isListening here — let onclose handle it
      };

      ws.onclose = () => {
        wsReadyRef.current = false;
        // Only set not-listening if audio is also stopped
        // (avoids premature stop if WS reconnects)
        if (isFinalizingRef.current) {
          finalize();
        }
        setIsListening(false);
        cleanupAudio();
        cleanupSocket();
        isStartingRef.current = false;
      };
    } catch (error) {
      console.warn('[Deepgram STT] start error', error);
      onErrorRef.current?.('token');
      setDebugStatus('変換エラー');
      setIsListening(false);
      isStartingRef.current = false;
      cleanupAudio();
      cleanupSocket();
    }
  }, [cleanupAudio, cleanupSocket, finalize, getToken, isSupported, sendPcm]);

  const stopAndSend = useCallback(() => {
    isFinalizingRef.current = true;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'Finalize' }));
      } catch {
        // ignore
      }
      window.setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close();
        }
      }, 1500);
    } else {
      // WS not open — just finalize with what we have
      finalize();
      cleanupSocket();
    }
    setDebugStatus('処理中...');
    setIsListening(false);
    cleanupAudio();
  }, [cleanupAudio, cleanupSocket, finalize]);

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
