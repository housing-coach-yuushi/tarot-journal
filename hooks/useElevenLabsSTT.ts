'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseElevenLabsSTTOptions {
    onFinalResult?: (transcript: string) => void;
}

export function useElevenLabsSTT(options: UseElevenLabsSTTOptions = {}) {
    const { onFinalResult } = options;

    const [isListening, setIsListening] = useState(false);
    const [currentTranscript, setCurrentTranscript] = useState('');
    const [isSupported, setIsSupported] = useState(false);
    const [debugStatus, setDebugStatus] = useState('init');

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const onFinalResultRef = useRef(onFinalResult);

    useEffect(() => {
        onFinalResultRef.current = onFinalResult;
    }, [onFinalResult]);

    useEffect(() => {
        if (typeof window !== 'undefined' && navigator.mediaDevices && window.MediaRecorder) {
            setIsSupported(true);
        }
    }, []);

    const startListening = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Determine supported mime type
            const mimeType = MediaRecorder.isTypeSupported('audio/webm')
                ? 'audio/webm'
                : 'audio/mp4';

            const recorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            recorder.onstart = () => {
                setIsListening(true);
                setDebugStatus('録音中 (ElevenLabs)');
            };

            recorder.onstop = async () => {
                setIsListening(false);
                setDebugStatus('処理中...');

                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                if (audioBlob.size < 1000) { // Too small, likely noise
                    setDebugStatus('音声が短すぎます');
                    return;
                }

                await sendToSTT(audioBlob);

                // Stop all tracks in the stream
                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start();
        } catch (error) {
            console.error('[STT] Failed to start recording:', error);
            setDebugStatus('マイク許可が必要です');
        }
    }, []);

    const sendToSTT = async (blob: Blob) => {
        try {
            const formData = new FormData();
            formData.append('audio', blob, 'recording.audio');

            const response = await fetch('/api/stt', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('STT API returned an error');
            }

            const { transcript } = await response.json();
            if (transcript) {
                setDebugStatus('取得成功');
                setCurrentTranscript(transcript);
                onFinalResultRef.current?.(transcript);
            } else {
                setDebugStatus('変換失敗 (空)');
            }
        } catch (error) {
            console.error('[STT] Transcription failed:', error);
            setDebugStatus('変換エラー');
        }
    };

    const stopAndSend = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    }, []);

    const cancel = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.onstop = null; // Prevent sending
            mediaRecorderRef.current.stop();
            // Stop tracks manually as onstop won't trigger the track cleanup
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        setIsListening(false);
        audioChunksRef.current = [];
        setDebugStatus('キャンセル');
    }, []);

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
