'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MessageSquare, Send, ChevronDown, Volume2, VolumeX, Loader2, Download, RotateCcw, Settings } from 'lucide-react';
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

// Generate or retrieve unique user ID
function getUserId(): string {
  if (typeof window === 'undefined') return 'default';

  const stored = localStorage.getItem('tarot-journal-user-id');
  if (stored) return stored;

  // Generate new UUID
  const newId = 'user-' + crypto.randomUUID();
  localStorage.setItem('tarot-journal-user-id', newId);
  return newId;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);  // バックグラウンド準備完了
  const [isSending, setIsSending] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);  // TTS準備中
  const [showChat, setShowChat] = useState(true);
  const [bootstrap, setBootstrap] = useState<BootstrapState>({ isBootstrapped: false });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [userId, setUserId] = useState<string>('default');
  const [showSettings, setShowSettings] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize userId on client side
  useEffect(() => {
    setUserId(getUserId());
  }, []);

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
      setIsGeneratingAudio(true);
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (response.ok) {
        log('音声取得完了、再生準備...');
        setIsGeneratingAudio(false);
        const audioBlob = await response.blob();
        if (audioBlob.size === 0) {
          log('音声データが空です');
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
              setIsSpeaking(false);
            });
        }
      } else {
        log('音声取得エラー: ' + response.status);
        setIsGeneratingAudio(false);
      }
    } catch (error) {
      log('TTS例外エラー: ' + (error as Error).message);
      setIsGeneratingAudio(false);
    }
  }, [ttsEnabled, log]);

  // Stop TTS
  const stopTTS = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsSpeaking(false);
  }, []);


  // Ref to hold pre-fetched initial data for tap-to-start
  const initDataRef = useRef<{ message: string; audioUrl: string | null; status: BootstrapState } | null>(null);

  // Background: fetch chat + TTS while showing "tap to start"
  useEffect(() => {
    const prepareInBackground = async () => {
      try {
        log('バックグラウンド準備開始...');
        setIsPreparing(true);

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

        const currentUserId = getUserId();
        setUserId(currentUserId);

        // Fetch status and initial message in parallel
        const [statusRes, chatRes] = await Promise.all([
          fetchWithTimeout(`/api/chat?userId=${currentUserId}`),
          fetchWithTimeout('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: [], userId: currentUserId }),
          }),
        ]);

        const status = await statusRes.json();
        let messageText = '';
        let audioUrl: string | null = null;

        if (chatRes.ok) {
          const data = await chatRes.json();
          messageText = data.message || '';
          if (data.identity || data.user) {
            status.identity = data.identity;
            status.user = data.user;
            status.isBootstrapped = data.isBootstrapped;
          }
          log('初期メッセージ取得成功');

          // Pre-fetch TTS audio
          if (messageText && ttsEnabled) {
            try {
              log('音声プリフェッチ中...');
              const ttsRes = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: messageText }),
              });
              if (ttsRes.ok) {
                const blob = await ttsRes.blob();
                if (blob.size > 0) {
                  audioUrl = URL.createObjectURL(blob);
                  log('音声プリフェッチ完了');
                }
              }
            } catch (e) {
              log('TTS準備失敗: ' + (e as Error).message);
            }
          }
        }

        // Store prepared data
        initDataRef.current = { message: messageText, audioUrl, status };
        setIsReady(true);
        log('準備完了 → タップ待ち');
      } catch (error) {
        log('初期化エラー: ' + (error as Error).message);
        // Even on error, let user tap to proceed
        setIsReady(true);
      } finally {
        setIsPreparing(false);
      }
    };

    prepareInBackground();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tap-to-start handler: unlock audio + show chat + play voice
  const handleTapToStart = useCallback(async () => {
    // Unlock audio context with user gesture
    if (audioRef.current) {
      try {
        await audioRef.current.play().catch(() => {});
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {}
    }
    setAudioUnlocked(true);
    log('オーディオアンロック完了');

    const data = initDataRef.current;
    if (data) {
      setBootstrap(data.status);

      if (data.message) {
        const initialMsg: Message = {
          id: 'initial-' + Date.now(),
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
        };
        setMessages([initialMsg]);
      }

      // Play pre-fetched audio immediately
      if (data.audioUrl && audioRef.current) {
        audioRef.current.src = data.audioUrl;
        audioRef.current.load();
        setIsSpeaking(true);
        try {
          await audioRef.current.play();
          log('初期音声再生開始');
        } catch (e) {
          log('音声再生失敗: ' + (e as Error).message);
          setIsSpeaking(false);
        }
      }
    }

    setIsLoading(false);
  }, [log]);

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
          userId,
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

  // Reset function
  const handleReset = useCallback(async (resetType: 'all' | 'ai' | 'user') => {
    const confirmMessage = resetType === 'all'
      ? '全てリセットして目覚めの儀式からやり直しますか？'
      : resetType === 'ai'
        ? 'AIのアイデンティティをリセットしますか？'
        : 'あなたのプロファイルをリセットしますか？';

    if (!confirm(confirmMessage)) return;

    setIsResetting(true);
    log(`リセット開始: ${resetType}`);

    try {
      const response = await fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, resetType }),
      });

      if (response.ok) {
        log('リセット完了');
        // Clear local state and reload
        setMessages([]);
        setBootstrap({ isBootstrapped: false });
        setShowSettings(false);
        // Reload page to start fresh
        window.location.reload();
      } else {
        log('リセット失敗');
      }
    } catch (error) {
      log('リセットエラー: ' + (error as Error).message);
    } finally {
      setIsResetting(false);
    }
  }, [userId, log]);

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
      {/* Loading / Tap-to-Start Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-[100] flex items-center justify-center"
            onClick={isReady ? handleTapToStart : undefined}
          >
            {!isReady ? (
              <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-white/70 font-light tracking-widest text-lg"
              >
                準備中...
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 cursor-pointer select-none"
              >
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                  className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center"
                >
                  <Volume2 size={32} className="text-white/80" />
                </motion.div>
                <p className="text-white/80 font-light tracking-widest text-lg">
                  タップして開始
                </p>
              </motion.div>
            )}
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
        <div className="flex-1 flex justify-end items-center gap-1">
          <button
            onClick={() => setShowChat(prev => !prev)}
            className="p-2 text-white/50 hover:text-white transition-colors"
          >
            {showChat ? <ChevronDown size={22} /> : <MessageSquare size={22} />}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-white/50 hover:text-white transition-colors"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white/10 backdrop-blur-md rounded-2xl p-6 max-w-sm w-full border border-white/20"
            >
              <h2 className="text-lg font-medium text-white mb-4">設定</h2>

              {/* Current Identity Info */}
              {bootstrap.identity?.name && (
                <div className="mb-6 p-3 bg-white/5 rounded-lg">
                  <p className="text-white/60 text-xs mb-1">現在のAI</p>
                  <p className="text-white">
                    {bootstrap.identity.emoji} {bootstrap.identity.name}
                  </p>
                  <p className="text-white/50 text-sm">{bootstrap.identity.creature}</p>
                </div>
              )}

              {/* Reset Options */}
              <div className="space-y-3">
                <button
                  onClick={() => handleReset('all')}
                  disabled={isResetting}
                  className="w-full flex items-center gap-3 p-3 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-300 transition-colors disabled:opacity-50"
                >
                  <RotateCcw size={18} />
                  <div className="text-left">
                    <p className="font-medium">目覚めの儀式からやり直す</p>
                    <p className="text-xs text-red-300/60">AIとユーザー情報を全てリセット</p>
                  </div>
                </button>

                <button
                  onClick={() => handleReset('user')}
                  disabled={isResetting}
                  className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg text-white/80 transition-colors disabled:opacity-50"
                >
                  <RotateCcw size={18} />
                  <div className="text-left">
                    <p className="font-medium">自分の情報をリセット</p>
                    <p className="text-xs text-white/40">名前と会話履歴をリセット</p>
                  </div>
                </button>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowSettings(false)}
                className="w-full mt-6 p-3 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 transition-colors"
              >
                閉じる
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

              {/* Audio generating indicator */}
              {isGeneratingAudio && !isSending && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm flex items-center gap-2">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="text-white/40"
                    >
                      <Volume2 size={14} />
                    </motion.div>
                    <span className="text-white/40 text-xs">音声生成中...</span>
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
                className="flex-1 bg-transparent text-white placeholder-white/40 outline-none text-base"
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
