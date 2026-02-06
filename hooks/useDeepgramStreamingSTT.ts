'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseDeepgramStreamingSTTOptions {
  onEnd?: (transcript: string) => void;
  onError?: (error: string, detail?: string) => void;
}

type SttErrorCode = 'permission' | 'no-mic' | 'device-busy' | 'token' | 'ws' | 'unknown';

const MIME_TYPE_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
];

function isLikelyIOSDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const platform = window.navigator.platform || '';
  const maxTouchPoints = window.navigator.maxTouchPoints || 0;
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || /iPhone|iPad|iPod/i.test(platform);
  const isIPadOSDesktopUA = platform === 'MacIntel' && maxTouchPoints > 1;
  return isIOS || isIPadOSDesktopUA;
}

function getPreferredMimeType(): string | undefined {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return undefined;
  const candidates = isLikelyIOSDevice()
    ? ['audio/mp4', ...MIME_TYPE_CANDIDATES]
    : MIME_TYPE_CANDIDATES;
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return undefined;
}

export function useDeepgramStreamingSTT(options: UseDeepgramStreamingSTTOptions = {}) {
  const { onEnd, onError } = options;

  const [isListening, setIsListening] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [debugStatus, setDebugStatus] = useState('init');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const selectedMimeTypeRef = useRef<string>('');
  const isLikelyIOSRef = useRef<boolean>(false);
  const shouldSendOnStopRef = useRef(false);
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
    isLikelyIOSRef.current = isLikelyIOSDevice();
    const supported = !!(
      navigator.mediaDevices
      && typeof navigator.mediaDevices.getUserMedia === 'function'
      && typeof window.MediaRecorder !== 'undefined'
    );
    setIsSupported(supported);
  }, []);

  const cleanupMedia = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onerror = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    chunksRef.current = [];
    selectedMimeTypeRef.current = '';
  }, []);

  const transcribeBlob = useCallback(async (blob: Blob, mimeTypeHint?: string) => {
    if (blob.size < 1200) {
      setDebugStatus('音声が短すぎます');
      return;
    }

    setDebugStatus('変換中...');
    try {
      const normalizedMimeType = (mimeTypeHint || blob.type || '').toLowerCase();
      const normalizedBlob = normalizedMimeType && blob.type !== normalizedMimeType
        ? new Blob([blob], { type: normalizedMimeType })
        : blob;
      const ext = normalizedMimeType.includes('mp4')
        ? 'm4a'
        : normalizedMimeType.includes('wav')
          ? 'wav'
          : normalizedMimeType.includes('ogg')
            ? 'ogg'
            : 'webm';
      const formData = new FormData();
      formData.append('audio', normalizedBlob, `recording.${ext}`);

      const response = await fetch('/api/stt', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        let detail = text;
        try {
          const parsed = JSON.parse(text) as { error?: string; details?: string; deepgramStatus?: number };
          detail = parsed.details || parsed.error || text;
        } catch {
          // ignore parse errors
        }
        const lower = detail.toLowerCase();

        if (lower.includes('invalid_auth') || lower.includes('invalid credentials') || response.status === 401 || response.status === 403) {
          setDebugStatus('トークン取得エラー');
          onErrorRef.current?.('token', detail.slice(0, 200));
          return;
        }
        if (lower.includes('too many requests') || response.status === 429) {
          setDebugStatus('接続タイムアウト');
          onErrorRef.current?.('ws', detail.slice(0, 200));
          return;
        }
        if (lower.includes('unsupported') || lower.includes('codec') || lower.includes('content-type') || lower.includes('media') || response.status === 415) {
          setDebugStatus('音声初期化エラー');
          onErrorRef.current?.('ws', detail.slice(0, 200));
          return;
        }

        throw new Error(detail || `stt ${response.status}`);
      }

      const data = await response.json();
      const transcript = typeof data?.transcript === 'string' ? data.transcript.trim() : '';

      if (!transcript) {
        setDebugStatus('音声が短すぎます');
        return;
      }

      setCurrentTranscript(transcript);
      setDebugStatus('完了');
      onEndRef.current?.(transcript);
    } catch (error) {
      console.warn('[Deepgram STT] transcribe failed', error);
      setDebugStatus('変換エラー');
      const detail = error instanceof Error ? error.message : String(error);
      onErrorRef.current?.('ws', detail.slice(0, 200));
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      setDebugStatus('未対応');
      return;
    }
    if (isListening || mediaRecorderRef.current) return;

    setCurrentTranscript('');
    setDebugStatus('マイク取得中');
    shouldSendOnStopRef.current = false;
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mimeType = getPreferredMimeType();
      selectedMimeTypeRef.current = mimeType || (isLikelyIOSRef.current ? 'audio/mp4' : 'audio/webm');
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
        if (event.data.type) {
          selectedMimeTypeRef.current = event.data.type;
        }
      };

      recorder.onerror = () => {
        setDebugStatus('マイク利用エラー');
        setIsListening(false);
        onErrorRef.current?.('device-busy');
        cleanupMedia();
      };

      recorder.onstop = async () => {
        const shouldSend = shouldSendOnStopRef.current;
        const recordedChunks = chunksRef.current.slice();
        const recordedMimeType = (
          recorder.mimeType
          || selectedMimeTypeRef.current
          || (isLikelyIOSRef.current ? 'audio/mp4' : 'audio/webm')
        ).toLowerCase();

        cleanupMedia();
        setIsListening(false);

        if (!shouldSend) {
          setDebugStatus('キャンセル');
          return;
        }

        await transcribeBlob(new Blob(recordedChunks, { type: recordedMimeType }), recordedMimeType);
      };

      recorder.start(250);
      setIsListening(true);
      setDebugStatus('録音中');
    } catch (error) {
      let errorCode: SttErrorCode = 'unknown';
      let status = '変換エラー';

      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
          errorCode = 'permission';
          status = 'マイク許可が必要です';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          errorCode = 'no-mic';
          status = 'マイクが見つかりません';
        } else if (error.name === 'NotReadableError' || error.name === 'AbortError') {
          errorCode = 'device-busy';
          status = 'マイク利用エラー';
        }
      }

      setDebugStatus(status);
      setIsListening(false);
      onErrorRef.current?.(errorCode);
      cleanupMedia();
    }
  }, [cleanupMedia, isListening, isSupported, transcribeBlob]);

  const stopAndSend = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      setIsListening(false);
      setDebugStatus('音声が短すぎます');
      return;
    }

    shouldSendOnStopRef.current = true;
    setDebugStatus('処理中...');
    setIsListening(false);

    if (recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      cleanupMedia();
      setDebugStatus('音声が短すぎます');
    }
  }, [cleanupMedia]);

  const cancel = useCallback(() => {
    shouldSendOnStopRef.current = false;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      return;
    }
    cleanupMedia();
    setIsListening(false);
    setDebugStatus('キャンセル');
    setCurrentTranscript('');
  }, [cleanupMedia]);

  useEffect(() => {
    return () => {
      shouldSendOnStopRef.current = false;
      cleanupMedia();
    };
  }, [cleanupMedia]);

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
