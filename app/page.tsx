'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, X, MessageSquare, Send, ChevronDown, Volume2, VolumeX, Sparkles, Loader2, Download } from 'lucide-react';
import GlowVisualizer from '@/components/GlowVisualizer';
import TarotDrawButton from '@/components/TarotDrawButton';
import TarotCardComponent from '@/components/TarotCard';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { TarotCard } from '@/lib/tarot/cards';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tarot';
  content: string;
  timestamp: Date;
  card?: TarotCard;  // For tarot card messages
}

interface BootstrapState {
  isBootstrapped: boolean;
  identity?: {
    name?: string;
    creature?: string;
    vibe?: string;
    emoji?: string;
  };
  user?: {
    name?: string;
    callName?: string;
  };
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);  // TTS準備中
  const [showChat, setShowChat] = useState(true);
  const [bootstrap, setBootstrap] = useState<BootstrapState>({ isBootstrapped: false });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [pendingAudioUrl, setPendingAudioUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Debug logger
  const log = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    const fullMsg = `[${timestamp}] ${msg}`;
    console.log(fullMsg);
    setDebugLog(prev => [...prev.slice(-20), fullMsg]);
  }, []);

  // Speech recognition hook - push-to-talk style
  const {
    isListening,
    currentTranscript,
    isSupported: sttSupported,
    debugStatus,
    startListening,
    stopAndSend,
    cancel: cancelListening,
  } = useSpeechRecognition({
    lang: 'ja-JP',
    onFinalResult: (text) => {
      // When released and has content, send it
      if (text.trim()) {
        sendMessage(text);
      }
    },
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Play TTS for a message
  const playTTS = useCallback(async (text: string) => {
    if (!ttsEnabled || !audioRef.current) {
      log('TTS無効またはAudioがありません');
      return;
    }

    try {
      log('音声生成開始: ' + text.substring(0, 10) + '...');
      setIsSpeaking(true);
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (response.ok) {
        log('音声取得完了、再生準備...');
        const audioBlob = await response.blob();
        if (audioBlob.size === 0) {
          log('音声データが空です');
          setIsSpeaking(false);
          return;
        }

        const audioUrl = URL.createObjectURL(audioBlob);

        // Cleanup old URL
        if (audioRef.current.src) {
          URL.revokeObjectURL(audioRef.current.src);
        }

        audioRef.current.src = audioUrl;
        audioRef.current.load(); // Ensure it's loaded

        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              log('再生開始');
              setAudioUnlocked(true);
            })
            .catch((e) => {
              log('再生自動ブロック(Play): ' + (e as Error).message);
              // Save audio URL for later playback when user taps
              setPendingAudioUrl(audioUrl);
              setIsSpeaking(false);
            });
        }
      } else {
        log('音声取得エラー: ' + response.status);
        setIsSpeaking(false);
      }
    } catch (error) {
      log('TTS例外エラー: ' + (error as Error).message);
      setIsSpeaking(false);
    }
  }, [ttsEnabled]);

  // Stop TTS
  const stopTTS = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsSpeaking(false);
  }, []);

  // Play pending audio (after user interaction to unlock audio)
  const playPendingAudio = useCallback(async () => {
    if (!pendingAudioUrl || !audioRef.current) return;

    try {
      log('ペンディング音声再生...');
      audioRef.current.src = pendingAudioUrl;
      audioRef.current.load();
      setIsSpeaking(true);
      await audioRef.current.play();
      log('ペンディング音声再生成功');
      setAudioUnlocked(true);
      setPendingAudioUrl(null);
    } catch (e) {
      log('ペンディング音声再生失敗: ' + (e as Error).message);
      setIsSpeaking(false);
    }
  }, [pendingAudioUrl, log]);

  // Check bootstrap status and get initial message
  useEffect(() => {
    const initChat = async () => {
      try {
        log('初期化開始...');
        setIsPreparing(true);

        // Fetch bootstrap status and initial message in parallel with timeout
        const fetchWithTimeout = async (url: string, options?: RequestInit, timeout = 60000) => {
          const controller = new AbortController();
          const id = setTimeout(() => controller.abort(), timeout);
          try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            return response;
          } catch (err: unknown) {
            clearTimeout(id);
            if (err instanceof Error && err.name === 'AbortError') {
              throw new Error('サーバー応答タイムアウト (60秒)');
            }
            throw err;
          }
        };

        const [statusRes, chatRes] = await Promise.all([
          fetchWithTimeout('/api/chat'),
          fetchWithTimeout('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: [] }),
          }),
        ]);

        const status = await statusRes.json();
        setBootstrap(status);

        if (chatRes.ok) {
          const data = await chatRes.json();
          if (data.message) {
            log('初期メッセージ取得成功');
            // Set message
            const initialMsg: Message = {
              id: 'initial-' + Date.now(),
              role: 'assistant',
              content: data.message,
              timestamp: new Date(),
            };
            setMessages([initialMsg]);

            // Move to chat immediately so text is visible while audio fetches
            setIsLoading(false);

            // Pre-fetch TTS for initial message
            if (ttsEnabled && audioRef.current) {
              try {
                log('初期音声取得中...');
                const ttsResponse = await fetch('/api/tts', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ text: data.message }),
                });

                if (ttsResponse.ok) {
                  const audioBlob = await ttsResponse.blob();
                  const audioUrl = URL.createObjectURL(audioBlob);
                  audioRef.current.src = audioUrl;
                  audioRef.current.load();
                  log('音声準備完了');

                  // Try auto-play
                  setIsSpeaking(true);
                  await audioRef.current.play().then(() => {
                    log('自動再生成功');
                    setAudioUnlocked(true);
                  }).catch((e) => {
                    log('自動再生ブロック: ' + e.message);
                    // Save audio URL for later playback when user taps
                    setPendingAudioUrl(audioUrl);
                    setIsSpeaking(false);
                  });
                }
              } catch (ttsError) {
                log('TTS準備失敗: ' + (ttsError as Error).message);
              }
            }
          }
        }
      } catch (error) {
        log('初期化エラー: ' + (error as Error).message);
      } finally {
        setIsLoading(false);
        setIsPreparing(false);
      }
    };

    initChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Send message (visible in chat)
  const sendMessage = useCallback(async (text: string, showInChat: boolean = true) => {
    if (!text.trim() || isSending) return;

    log(`メッセージ送信開始: ${text.substring(0, 10)}...`);
    setIsSending(true);

    // Stop any ongoing TTS
    stopTTS();

    // Only add to chat if showInChat is true
    if (showInChat) {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);
      setInput('');
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.map(m => ({
            role: m.role === 'tarot' ? 'user' : m.role,  // Convert tarot to user for API
            content: m.role === 'tarot' && m.card
              ? `[カード: ${m.card.name} ${m.card.symbol}]`
              : m.content,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        log('レスポンス受信');

        // Update bootstrap state
        if (data.identity || data.user) {
          setBootstrap(prev => ({
            ...prev,
            isBootstrapped: data.isBootstrapped,
            identity: data.identity,
            user: data.user,
          }));
        }

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);

        // Play TTS for response
        playTTS(data.message);
      } else {
        log('チャットAPIエラー: ' + response.status);
      }
    } catch (error) {
      log('送信エラー: ' + (error as Error).message);
    } finally {
      setIsSending(false);
    }
  }, [messages, isSending, log, stopTTS, playTTS]);

  // Save and Download journal
  const handleSave = useCallback(async () => {
    if (messages.length === 0 || isSummarizing) return;

    setIsSummarizing(true);
    log('要約中...');

    try {
      const response = await fetch('/api/journal/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          userId: 'default', // Using default for now
        }),
      });

      if (response.ok) {
        const data = await response.json();
        log('要約完了: ' + data.title);

        // Create download file (Obsidian style Markdown)
        const dateStr = new Date().toISOString().split('T')[0];
        const markdownContent = `---
title: "${data.title}"
date: ${dateStr}
tags: [tarot, journal]
---

# ${data.title}
**日付:** ${dateStr}

## 要約
${data.summary}

## 対話履歴
${messages.map(m => `### ${m.role === 'user' ? '裕士' : 'カイ'}\n${m.content}`).join('\n\n')}
`;

        const blob = new Blob([markdownContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dateStr}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(`保存しました：${dateStr}.md\n\n${data.title}`);
      } else {
        log('要約失敗');
      }
    } catch (error) {
      log('保存エラー: ' + (error as Error).message);
    } finally {
      setIsSummarizing(false);
    }
  }, [messages, isSummarizing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Push-to-talk: start on press
  const handleMicDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    log('押した');
    stopTTS();
    startListening();
  };

  // Push-to-talk: send on release
  const handleMicUp = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    log('離した');
    stopAndSend();
  };

  return (
    <main className="fixed inset-0 bg-black text-white overflow-hidden flex flex-col">
      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center pointer-events-none"
          >
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-white/70 font-light tracking-widest text-lg"
            >
              目覚めています...
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audio Unlock Prompt - Subtle tap indicator for Safari */}
      <AnimatePresence>
        {pendingAudioUrl && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[90]"
          >
            <motion.button
              onClick={playPendingAudio}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 bg-white/15 backdrop-blur-md rounded-full border border-white/20 text-white/90 text-sm"
            >
              <Volume2 size={16} />
              <span>タップして音声を再生</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Aurora Glow Effect */}
      <GlowVisualizer isActive={isListening || isSending || isSpeaking} />

      {/* Top Bar */}
      <div className="relative z-20 flex items-center justify-between px-4 py-3 safe-area-top min-h-[60px]">
        {/* Left: TTS Toggle */}
        <div className="flex-1 flex justify-start">
          <button
            onClick={() => setTtsEnabled(prev => !prev)}
            className="p-2 text-white/50 hover:text-white transition-colors"
          >
            {ttsEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
        </div>

        {/* Center: Live Indicator */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 text-white/90">
          <div className="flex items-center gap-1">
            <motion.div
              animate={isListening || isSpeaking ? { opacity: [0.5, 1, 0.5] } : { opacity: 0.8 }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-0.5 h-3 bg-white/80 rounded-full"
            />
            <motion.div
              animate={isListening || isSpeaking ? { opacity: [0.3, 0.8, 0.3] } : { opacity: 0.6 }}
              transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}
              className="w-0.5 h-2 bg-white/60 rounded-full"
            />
            <motion.div
              animate={isListening || isSpeaking ? { opacity: [0.5, 1, 0.5] } : { opacity: 0.8 }}
              transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }}
              className="w-0.5 h-3 bg-white/80 rounded-full"
            />
          </div>
          <span className="text-sm font-medium tracking-widest uppercase">
            {bootstrap.identity?.name || 'Live'}
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex-1 flex justify-end items-center">
          <button
            onClick={() => setShowChat(prev => !prev)}
            className="p-2 text-white/50 hover:text-white transition-colors"
          >
            {showChat ? <ChevronDown size={22} /> : <MessageSquare size={22} />}
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex-1 overflow-y-auto px-4 pb-4 z-10"
          >
            <div className="max-w-2xl mx-auto space-y-4 pt-4">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'tarot' && msg.card ? (
                    // Tarot card inline display
                    <TarotCardComponent card={msg.card} />
                  ) : (
                    <div
                      className={`max-w-[85%] px-4 py-3 rounded-2xl ${msg.role === 'user'
                        ? 'bg-blue-600/80 text-white'
                        : 'bg-white/10 backdrop-blur-sm text-white/90'
                        }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Sending indicator with spinner */}
              {isSending && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="px-4 py-3 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center gap-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      className="text-white/60"
                    >
                      <Loader2 size={16} />
                    </motion.div>
                    <span className="text-white/50 text-sm">考えています...</span>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Non-chat mode: Show last message as caption */}
      {!showChat && messages.length > 0 && (
        <div className="flex-1 flex items-center justify-center z-10 px-8">
          <motion.p
            key={messages[messages.length - 1]?.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xl md:text-2xl text-center text-white/90 leading-relaxed max-w-md"
          >
            {messages[messages.length - 1]?.content}
          </motion.p>
        </div>
      )}

      {/* Debug Log - Only in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-[65px] left-4 z-50 pointer-events-none max-w-[250px]">
          <div className="bg-black/60 backdrop-blur-md rounded-md p-2 font-mono text-[10px] sm:text-[12px] text-green-400 border border-green-500/20">
            <div className="flex gap-2 mb-1 border-b border-white/10 pb-1">
              <span className="opacity-70">STT:</span> <span>{sttSupported ? 'Y' : 'N'}</span>
              <span className="opacity-70 ml-2">State:</span> <span>{debugStatus}</span>
            </div>
            <div className="space-y-0.5">
              {debugLog.slice(-5).map((msg, i) => <div key={i} className="line-clamp-1">{msg}</div>)}
            </div>
          </div>
        </div>
      )}

      {/* Listening indicator with current transcript */}
      {isListening && (
        <div className="absolute bottom-40 left-0 right-0 flex justify-center z-30 px-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 backdrop-blur-md rounded-2xl px-6 py-3 max-w-md"
          >
            <p className="text-white/80 text-sm text-center">
              {currentTranscript || '🎤 押したまま話してください...'}
            </p>
          </motion.div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="relative z-20 p-4 safe-area-bottom">
        <div className="max-w-2xl mx-auto">
          {/* Input Form */}
          <form onSubmit={handleSubmit} className="flex items-center gap-3 mb-4">
            <div className="flex-1 flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="メッセージを入力..."
                className="flex-1 bg-transparent text-white placeholder-white/40 outline-none text-sm"
                disabled={isSending || isListening}
              />
              <motion.button
                type="submit"
                whileTap={{ scale: 0.9 }}
                disabled={!input.trim() || isSending}
                className="p-2 rounded-full bg-blue-600 text-white disabled:opacity-50"
              >
                <Send size={16} />
              </motion.button>
            </div>
          </form>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-6">
            {/* Tarot Draw Button */}
            <div className="flex-1 flex justify-end">
              <TarotDrawButton
                disabled={isSending || isListening}
                onCardDrawn={(card: TarotCard) => {
                  // Add tarot card as a message in chat
                  const tarotMessage: Message = {
                    id: Date.now().toString(),
                    role: 'tarot',
                    content: '',
                    timestamp: new Date(),
                    card: card,
                  };
                  setMessages(prev => [...prev, tarotMessage]);

                  // Send card info to AI for context-aware response (hidden from chat)
                  const hour = new Date().getHours();
                  const timeOfDay = (hour >= 5 && hour < 12) ? '朝' : '夜';
                  const reflection = (hour >= 5 && hour < 12) ? card.reflection.morning : card.reflection.evening;
                  const cardContext = `[タロットカードを引きました: ${card.name} ${card.symbol}]\nキーワード: ${card.keywords.join('、')}\n問い: ${reflection}\n（${timeOfDay}のジャーナリングセッション）`;
                  sendMessage(cardContext, false);  // false = don't show in chat
                }}
              />
            </div>

            {/* Mic Button - Push to talk (Center) */}
            <motion.div className="relative">
              <AnimatePresence>
                {isListening && (
                  <>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{
                        opacity: [0, 0.4, 0],
                        scale: [1, 1.5, 1.8],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.5,
                        ease: "easeOut"
                      }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute inset-0 rounded-full bg-red-500 blur-xl"
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{
                        opacity: [0, 0.6, 0],
                        scale: [1, 1.3, 1.5],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.5,
                        delay: 0.2,
                        ease: "easeOut"
                      }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute inset-0 rounded-full bg-red-400 blur-lg"
                    />

                    {/* Cancel Button - Absolute position so it doesn't shift the layout */}
                    <motion.button
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelListening();
                      }}
                      className="absolute -right-16 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/10 text-white/70 hover:bg-white/20 transition-colors z-20"
                    >
                      <X size={20} />
                    </motion.button>
                  </>
                )}
              </AnimatePresence>
              <motion.button
                onMouseDown={handleMicDown}
                onMouseUp={handleMicUp}
                onMouseLeave={handleMicUp}
                onTouchStart={handleMicDown}
                onTouchEnd={handleMicUp}
                whileTap={{ scale: 0.95 }}
                disabled={!sttSupported || isSending}
                className={`p-6 rounded-full transition-all select-none relative z-10 ${isListening
                  ? 'bg-red-500 text-white scale-110 shadow-lg shadow-red-500/40'
                  : 'bg-white/10 backdrop-blur-sm text-white/80 hover:bg-white/20 border border-white/10'
                  } ${!sttSupported || isSending ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Mic size={32} />
              </motion.button>
            </motion.div>

            {/* Save (Journal) Button */}
            <div className="flex-1 flex justify-start">
              <motion.button
                onClick={handleSave}
                disabled={isSending || messages.length === 0 || isSummarizing}
                whileTap={{ scale: 0.95 }}
                title="要約して保存"
                className={`p-4 rounded-full bg-white/10 backdrop-blur-sm text-white/80 hover:bg-white/20 border border-white/10 transition-all ${isSending || messages.length === 0 ? 'opacity-20 cursor-not-allowed' : ''}`}
              >
                {isSummarizing ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  >
                    <Loader2 size={24} />
                  </motion.div>
                ) : (
                  <Download size={24} />
                )}
              </motion.button>
            </div>

          </div>
        </div>
      </div>
      <audio
        ref={audioRef}
        onEnded={() => setIsSpeaking(false)}
        onError={() => setIsSpeaking(false)}
        style={{ display: 'none' }}
      />
    </main>
  );
}
