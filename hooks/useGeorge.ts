'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface Message {
    id: string;
    role: 'user' | 'george';
    content: string;
    timestamp: Date;
}

interface UseGeorgeOptions {
    onCaptionChange?: (caption: string) => void;
    onAudioLevelChange?: (level: number) => void;
}

export function useGeorge(options: UseGeorgeOptions = {}) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentCaption, setCurrentCaption] = useState('');
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);

    // Initialize audio context
    useEffect(() => {
        if (typeof window !== 'undefined') {
            audioRef.current = new Audio();
        }
    }, []);

    // Update caption
    useEffect(() => {
        options.onCaptionChange?.(currentCaption);
    }, [currentCaption, options]);

    // Send message to George
    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || isProcessing) return;

        setIsProcessing(true);

        // Add user message
        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);

        try {
            // Get response from chat API
            const chatResponse = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    history: messages.slice(-10).map(m => ({
                        role: m.role === 'george' ? 'assistant' : 'user',
                        content: m.content,
                    })),
                }),
            });

            if (!chatResponse.ok) throw new Error('Chat failed');

            const { message: georgeText } = await chatResponse.json();

            // Add George's message
            const georgeMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'george',
                content: georgeText,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, georgeMessage]);
            setCurrentCaption(georgeText);

            // Get TTS audio
            const ttsResponse = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: georgeText }),
            });

            if (ttsResponse.ok && audioRef.current) {
                const audioBlob = await ttsResponse.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                audioRef.current.src = audioUrl;

                // Set up audio analysis for visualizer
                if (!audioContextRef.current) {
                    audioContextRef.current = new AudioContext();
                    const source = audioContextRef.current.createMediaElementSource(audioRef.current);
                    analyserRef.current = audioContextRef.current.createAnalyser();
                    source.connect(analyserRef.current);
                    analyserRef.current.connect(audioContextRef.current.destination);
                }

                await audioRef.current.play();

                // Monitor audio levels
                if (analyserRef.current) {
                    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
                    const updateLevel = () => {
                        if (analyserRef.current && audioRef.current && !audioRef.current.paused) {
                            analyserRef.current.getByteFrequencyData(dataArray);
                            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                            options.onAudioLevelChange?.(average / 255);
                            requestAnimationFrame(updateLevel);
                        } else {
                            options.onAudioLevelChange?.(0);
                        }
                    };
                    updateLevel();
                }

                audioRef.current.onended = () => {
                    URL.revokeObjectURL(audioUrl);
                    options.onAudioLevelChange?.(0);
                };
            }

        } catch (error) {
            console.error('George error:', error);
            setCurrentCaption('...すまない、少し調子が悪いようだ。');
        } finally {
            setIsProcessing(false);
        }
    }, [messages, isProcessing, options]);

    // Get initial greeting
    const getGreeting = useCallback(async () => {
        setIsProcessing(true);
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isFirstMessage: true }),
            });

            if (!response.ok) throw new Error('Greeting failed');

            const { message } = await response.json();

            const georgeMessage: Message = {
                id: Date.now().toString(),
                role: 'george',
                content: message,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, georgeMessage]);
            setCurrentCaption(message);

            // Play greeting audio
            const ttsResponse = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: message }),
            });

            if (ttsResponse.ok && audioRef.current) {
                const audioBlob = await ttsResponse.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                audioRef.current.src = audioUrl;
                await audioRef.current.play();
                audioRef.current.onended = () => URL.revokeObjectURL(audioUrl);
            }

        } catch (error) {
            console.error('Greeting error:', error);
            const fallback = "やあ、いらっしゃい。";
            setCurrentCaption(fallback);
        } finally {
            setIsProcessing(false);
        }
    }, []);

    // Stop audio playback
    const stopAudio = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        options.onAudioLevelChange?.(0);
    }, [options]);

    return {
        messages,
        currentCaption,
        isProcessing,
        sendMessage,
        getGreeting,
        stopAudio,
    };
}
