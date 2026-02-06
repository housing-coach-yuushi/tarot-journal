'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseElevenLabsSTTOptions {
    onFinalResult?: (transcript: string) => void;
    onEnd?: (transcript: string) => void;
    onError?: (error: string) => void;
}

export function useElevenLabsSTT(options: UseElevenLabsSTTOptions = {}) {
    const { onFinalResult, onEnd, onError } = options;

    const [isListening, setIsListening] = useState(false);
    const [currentTranscript, setCurrentTranscript] = useState('');
    const [isSupported, setIsSupported] = useState(false);
    const [debugStatus, setDebugStatus] = useState('init');

    const recognitionRef = useRef<any>(null);
    const onFinalResultRef = useRef(onFinalResult);
    const onEndRef = useRef(onEnd);
    const onErrorRef = useRef(onError);
    const finalTranscriptRef = useRef('');
    const interimTranscriptRef = useRef('');
    const cancelRef = useRef(false);

    useEffect(() => {
        onFinalResultRef.current = onFinalResult;
    }, [onFinalResult]);

    useEffect(() => {
        onEndRef.current = onEnd;
    }, [onEnd]);

    useEffect(() => {
        onErrorRef.current = onError;
    }, [onError]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setIsSupported(false);
            return;
        }

        setIsSupported(true);
        const recognition = new SpeechRecognition();
        recognition.lang = 'ja-JP';
        recognition.interimResults = true;
        recognition.continuous = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
            setDebugStatus('録音中 (ブラウザ)');
        };

        recognition.onresult = (event: any) => {
            let finalText = '';
            let interimText = '';

            for (let i = event.resultIndex; i < event.results.length; i += 1) {
                const transcript = event.results[i][0]?.transcript || '';
                if (event.results[i].isFinal) {
                    finalText += transcript;
                } else {
                    interimText += transcript;
                }
            }

            if (finalText) {
                finalTranscriptRef.current = `${finalTranscriptRef.current} ${finalText}`.trim();
            }
            if (interimText) {
                interimTranscriptRef.current = interimText.trim();
            } else {
                interimTranscriptRef.current = '';
            }

            const combined = `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim();
            if (combined) {
                setCurrentTranscript(combined);
            }
        };

        recognition.onerror = (event: any) => {
            const errorType = event?.error || 'unknown';
            if (errorType === 'not-allowed' || errorType === 'service-not-allowed') {
                setDebugStatus('マイク許可が必要です');
            } else if (errorType === 'no-speech') {
                setDebugStatus('音声が短すぎます');
            } else {
                setDebugStatus('変換エラー');
            }
            onErrorRef.current?.(errorType);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);

            if (cancelRef.current) {
                cancelRef.current = false;
                setDebugStatus('キャンセル');
                setCurrentTranscript('');
                finalTranscriptRef.current = '';
                interimTranscriptRef.current = '';
                return;
            }

            const finalText = finalTranscriptRef.current || interimTranscriptRef.current;
            if (finalText) {
                setDebugStatus('取得成功');
                setCurrentTranscript(finalText);
                onFinalResultRef.current?.(finalText);
            } else {
                setDebugStatus('変換失敗 (空)');
            }

            onEndRef.current?.(finalText);

            finalTranscriptRef.current = '';
            interimTranscriptRef.current = '';
        };

        recognitionRef.current = recognition;

        return () => {
            recognition.onstart = null;
            recognition.onresult = null;
            recognition.onerror = null;
            recognition.onend = null;
            recognitionRef.current = null;
        };
    }, []);

    const startListening = useCallback(async () => {
        if (!recognitionRef.current) {
            setDebugStatus('変換エラー');
            return;
        }

        try {
            finalTranscriptRef.current = '';
            interimTranscriptRef.current = '';
            setCurrentTranscript('');
            setDebugStatus('録音準備中');
            recognitionRef.current.start();
        } catch (error) {
            console.error('[STT] Failed to start recognition:', error);
            setDebugStatus('マイク許可が必要です');
        }
    }, []);

    const stopAndSend = useCallback(() => {
        if (recognitionRef.current && isListening) {
            setDebugStatus('処理中...');
            recognitionRef.current.stop();
        }
    }, [isListening]);

    const cancel = useCallback(() => {
        if (recognitionRef.current && isListening) {
            cancelRef.current = true;
            recognitionRef.current.stop();
        }
        setIsListening(false);
        setCurrentTranscript('');
        setDebugStatus('キャンセル');
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
