'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseDeepgramStreamingSTTOptions {
  onEnd?: (transcript: string) => void;
  onError?: (error: string) => void;
}

type SttErrorCode = 'permission' | 'no-mic' | 'device-busy' | 'ws' | 'unknown';

const MIME_TYPE_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
];

function getPreferredMimeType(): string | undefined {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return undefined;
  for (const mime of MIME_TYPE_CANDIDATES) {
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
  }, []);

  const transcribeBlob = useCallback(async (blob: Blob) => {
    if (blob.size < 1200) {
      setDebugStatus('音声が短すぎます');
      return;
    }

    setDebugStatus('変換中...');
    try {
      const formData = new FormData();
      const ext = blob.type.includes('mp4') ? 'm4a' : 'webm';
      formData.append('audio', blob, `recording.${ext}`);

      const response = await fetch('/api/stt', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `stt ${response.status}`);
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
      onErrorRef.current?.('ws');
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
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
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
        const recordedMimeType = recorder.mimeType || 'audio/webm';

        cleanupMedia();
        setIsListening(false);

        if (!shouldSend) {
          setDebugStatus('キャンセル');
          return;
        }

        await transcribeBlob(new Blob(recordedChunks, { type: recordedMimeType }));
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
