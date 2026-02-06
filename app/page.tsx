'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { Mic, MessageSquare, Send, ChevronDown, Volume2, VolumeX, Loader2, Download, RotateCcw, Settings, Share2 } from 'lucide-react';
import GlowVisualizer from '@/components/GlowVisualizer';
import TarotDrawButton from '@/components/TarotDrawButton';
import { useElevenLabsSTT } from '@/hooks/useElevenLabsSTT';
import { TarotCard, DrawnCard, drawRandomCard } from '@/lib/tarot/cards';
import { Radio } from 'lucide-react';

const TarotCardReveal = dynamic(() => import('@/components/TarotCardReveal').then(m => m.TarotCardReveal), {
  ssr: false,
});
const TarotDeckShuffle = dynamic(() => import('@/components/TarotDeckShuffle').then(m => m.TarotDeckShuffle), {
  ssr: false,
});
const SettingsModal = dynamic(() => import('@/components/SettingsModal').then(m => m.default), {
  ssr: false,
});
const GeorgeRadio = dynamic(() => import('@/components/GeorgeRadio').then(m => m.default), {
  ssr: false,
});

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tarot';
  content: string;
  timestamp: Date;
  card?: DrawnCard;
}

interface BootstrapState {
  isBootstrapped: boolean;
  identity?: {
    name?: string;
    creature?: string;
    vibe?: string;
    emoji?: string;
    voiceId?: string;
    showDebug?: boolean;
    bgmEnabled?: boolean;
  };
  user?: {
    name?: string;
    callName?: string;
  };
  history?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
  }>;
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
  const prefersReducedMotion = useReducedMotion();
  const supportsPointerEvents = typeof window !== 'undefined' && 'PointerEvent' in window;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);  // バックグラウンド準備完了
  const [isSending, setIsSending] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);  // TTS準備中
  const [showChat, setShowChat] = useState(true);
  const [bootstrap, setBootstrap] = useState<BootstrapState>({
    isBootstrapped: false,
    identity: { showDebug: false }
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [userId, setUserId] = useState<string>('default');
  const [showSettings, setShowSettings] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [checkinLines, setCheckinLines] = useState<string[] | null>(null);
  const [showTapHint, setShowTapHint] = useState(false);
  const [showRadio, setShowRadio] = useState(false);
  const [radioNotification, setRadioNotification] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const ttsVersionRef = useRef<number>(0); // Track latest TTS request version
  const [isShuffleOpen, setIsShuffleOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSendTextRef = useRef<string>('');
  const noticeTimerRef = useRef<number | null>(null);
  const ttsEnabledRef = useRef<boolean>(ttsEnabled);
  const hasHistoryRef = useRef<boolean>(false);
  const touchActiveRef = useRef<boolean>(false);
  const sendOnFinalRef = useRef<boolean>(false);
  const isHoldingMicRef = useRef<boolean>(false);
  const isListeningRef = useRef<boolean>(false);
  const micRetryTimerRef = useRef<number | null>(null);
  const heldTranscriptRef = useRef<string>('');
  const currentTranscriptRef = useRef<string>('');
  const pendingSendTimerRef = useRef<number | null>(null);
  // checkin is shown directly in chat for new users
  const MAX_RENDER_MESSAGES = 80;

  // BGM playback control
  useEffect(() => {
    if (!bgmRef.current) return;

    const isEnabled = bootstrap.identity?.bgmEnabled === true;

    if (isEnabled && audioUnlocked) {
      bgmRef.current.play().catch(e => console.warn(`BGM play failed: ${e.message}`));
      bgmRef.current.volume = 0.005; // 0.01でもうるさいとのことなのでさらに下げる
    } else {
      bgmRef.current.pause();
    }
  }, [bootstrap.identity?.bgmEnabled, audioUnlocked]);

  // Debug logger
  const log = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    const fullMsg = `[${timestamp}] ${msg}`;
    console.log(fullMsg);
    setDebugLog(prev => [...prev.slice(-20), fullMsg]);
  }, []);

  useEffect(() => {
    ttsEnabledRef.current = ttsEnabled;
  }, [ttsEnabled]);

  const pushNotice = useCallback((type: 'info' | 'success' | 'error', message: string, ttlMs = 4000) => {
    setNotice({ type, message });
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, ttlMs);
  }, []);

  // Initialize userId on client side
  useEffect(() => {
    setUserId(getUserId());
  }, []);

  // Fallback: always allow tap after a short delay even if checkin fails
  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => setShowTapHint(true), 6000);
    return () => clearTimeout(timer);
  }, [isLoading]);


  // Speech recognition hook - ElevenLabs Scribe v2
  const {
    isListening,
    currentTranscript,
    isSupported: sttSupported,
    debugStatus,
    startListening,
    stopAndSend,
    cancel,
  } = useElevenLabsSTT({
    onEnd: (text: string) => {
      if (text.trim()) {
        heldTranscriptRef.current = `${heldTranscriptRef.current} ${text}`.trim();
      }
      if (sendOnFinalRef.current) {
        sendOnFinalRef.current = false;
        if (pendingSendTimerRef.current) {
          window.clearTimeout(pendingSendTimerRef.current);
          pendingSendTimerRef.current = null;
        }
        const toSend = heldTranscriptRef.current;
        heldTranscriptRef.current = '';
        if (toSend.trim()) {
          sendMessage(toSend);
        }
        return;
      }
      if (isHoldingMicRef.current) {
        window.setTimeout(() => startListening(), 100);
      }
    },
    onError: (errorType: string) => {
      if (!isHoldingMicRef.current) return;
      if (errorType === 'no-speech' || errorType === 'aborted' || errorType === 'audio-capture') {
        window.setTimeout(() => startListening(), 150);
      }
    },
  });

  useEffect(() => {
    if (isHoldingMicRef.current) return;
    if (debugStatus === 'マイク許可が必要です') {
      pushNotice('error', 'マイクの許可が必要です。ブラウザ設定を確認してください。', 6000);
    } else if (debugStatus === '変換エラー') {
      pushNotice('error', '音声の変換に失敗しました。もう一度試してください。', 5000);
    } else if (debugStatus === '音声が短すぎます') {
      pushNotice('info', '音声が短すぎます。もう少し長く話してください。', 4000);
    }
  }, [debugStatus, pushNotice]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    currentTranscriptRef.current = currentTranscript;
  }, [currentTranscript]);

  // Play TTS for a message (Full)
  const playTTS = useCallback(async (text: string) => {
    if (!ttsEnabled || !audioRef.current) {
      log('TTS無効またはAudioがありません');
      return;
    }

    log('音声生成開始...');
    setIsGeneratingAudio(true);
    const currentVersion = ++ttsVersionRef.current;

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (currentVersion !== ttsVersionRef.current) {
        log('TTSリクエストがキャンセルされました(新リクエストあり)');
        return;
      }

      if (response.ok) {
        const audioBlob = await response.blob();
        if (currentVersion !== ttsVersionRef.current) return;

        if (audioBlob.size > 0) {
          log(`音声受信: ${audioBlob.size} bytes`);
          const url = URL.createObjectURL(audioBlob);
          if (audioRef.current) {
            if (audioRef.current.src && audioRef.current.src.startsWith('blob:')) {
              URL.revokeObjectURL(audioRef.current.src);
            }
            audioRef.current.src = url;
            audioRef.current.load();
            setIsSpeaking(true);
            setIsGeneratingAudio(false);
            await audioRef.current.play();
            log('音声再生開始');
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        log('TTSエラー: ' + (errorData.details || errorData.error || response.status));
        setIsGeneratingAudio(false);
      }
    } catch (error) {
      log('音声再生失敗: ' + (error as Error).message);
      setIsGeneratingAudio(false);
    }
  }, [ttsEnabled, log]);

  // Stop TTS
  const stopTTS = useCallback(() => {
    log('音声停止');
    ttsVersionRef.current++; // Invalidate any pending TTS fetches
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      if (audioRef.current.src && audioRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      audioRef.current.src = '';
    }
    setIsSpeaking(false);
    setIsGeneratingAudio(false);
  }, [log]);

  const unlockAudio = useCallback(async () => {
    if (audioUnlocked || !audioRef.current) return;
    try {
      const audio = audioRef.current;
      audio.volume = 1.0;
      audio.muted = false;
      audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
      audio.load();
      const p = audio.play();
      if (p) {
        await p;
        audio.pause();
        audio.currentTime = 0;
      }
      setAudioUnlocked(true);
      log('オーディオアンロック完了');
    } catch (e) {
      log('オーディオアンロック失敗: ' + (e as Error).message);
    }
  }, [audioUnlocked, log]);


  // Ref to hold pre-fetched initial data for tap-to-start
  const initDataRef = useRef<{ message: string; audioUrl: string | null; status: BootstrapState } | null>(null);

  // Background: fetch chat + TTS while showing "tap to start"
  const prepareInBackground = useCallback(async () => {
      try {
        log('バックグラウンド準備開始...');
        setIsPreparing(true);
        setInitError(null);

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

        // Fetch status (history) first to speed up returning users
        const statusRes = await fetchWithTimeout(`/api/chat?userId=${currentUserId}`);
        const status = await statusRes.json();

        if (status?.history && status.history.length > 0) {
          hasHistoryRef.current = true;
          initDataRef.current = { message: '', audioUrl: null, status };
          log(`履歴あり: ${status.history.length}件`);
          return;
        }

        // No history: fetch checkin lines (text only)
        let lines: string[] | null = null;
        try {
          const res = await fetchWithTimeout(`/api/checkin?userId=${currentUserId}`);
          if (res.ok) {
            const data = await res.json();
            lines = data.lines;
            setCheckinLines(data.lines);
          }
        } catch {
          // ignore
        }

        setBootstrap(status);
        const fallbackLines = ['自分と向き合う時間を始めます', '一緒にジャーナルをつけていきましょう', '心を静かにして...'];
        const checkin = lines && lines.length > 0 ? lines : fallbackLines;
        const checkinMessage: Message = {
          id: 'checkin-' + Date.now(),
          role: 'assistant',
          content: checkin.join('\n'),
          timestamp: new Date(),
        };
        const guideMessage: Message = {
          id: 'guide-' + Date.now(),
          role: 'assistant',
          content: 'マイクを押して、今の気持ちを話してみてください。',
          timestamp: new Date(),
        };
        setMessages([checkinMessage, guideMessage]);
        log('履歴なし。チェックインのみ表示します');
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        log(`初期化エラー詳細: ${errMsg}`);
        setInitError('通信に失敗しました。再試行してください。');
      } finally {
        setIsReady(true);
        setIsPreparing(false);
        setIsGeneratingAudio(false);
      }
    }, [log]);

  useEffect(() => {
    prepareInBackground();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepareInBackground]);

  // Tap-to-start is no longer used; keep as no-op for safety
  const handleTapToStart = useCallback(async () => {
    return;
  }, []);

  // When background prep finishes, apply data
  useEffect(() => {
    if (isReady && !isLoading && initDataRef.current) {
      const data = initDataRef.current;
      initDataRef.current = null; // consume once

      setBootstrap(data.status);

      // Restore history from Cloud (Redis)
      if (data.status.history && data.status.history.length > 0) {
        log(`履歴を復元中: ${data.status.history.length}件`);
        const restoredMessages: Message[] = data.status.history.map((m: any, i: number) => ({
          id: `restored-${i}-${Date.now()}`,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp || Date.now()),
        }));
        setMessages(restoredMessages);
      } else {
        const fallbackLines = ['自分と向き合う時間を始めます', '一緒にジャーナルをつけていきましょう', '心を静かにして...'];
        const lines = checkinLines && checkinLines.length > 0 ? checkinLines : fallbackLines;
        const checkinMessage: Message = {
          id: 'checkin-' + Date.now(),
          role: 'assistant',
          content: lines.join('\n'),
          timestamp: new Date(),
        };
        const guideMessage: Message = {
          id: 'guide-' + Date.now(),
          role: 'assistant',
          content: 'マイクを押して、今の気持ちを話してみてください。',
          timestamp: new Date(),
        };
        setMessages([checkinMessage, guideMessage]);
      }
    } else if (isReady && !isLoading && !initDataRef.current && initError) {
      log('初期メッセージが取得できなかったため、フォールバックメッセージを表示します');
      setMessages([{
        id: 'error-fallback-' + Date.now(),
        role: 'assistant' as const,
        content: '...。......あ、れ......。すまない、今は少し意識が遠のいているみたいだ（通信エラー）。少し時間を置いてからまた話しかけてくれるかい？',
        timestamp: new Date(),
      }]);
    }
  }, [isReady, isLoading, log, checkinLines, initError]);

  // Send message (visible in chat)
  const sendMessage = useCallback(async (text: string, showInChat: boolean = true) => {
    if (!text.trim()) return;

    log(`メッセージ送信開始: ${text.substring(0, 10)}...`);
    setSendError(null);
    lastSendTextRef.current = text;

    // Abort any existing request
    if (abortControllerRef.current) {
      log('以前のメッセージリクエストを中断します');
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsSending(true);

    // Clear input immediately to prevent double-send
    if (showInChat) {
      setInput('');
    }

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
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          userId,
          history: messages.map(m => ({
            role: m.role === 'tarot' ? 'user' : m.role,  // Convert tarot to user for API
            content: m.role === 'tarot' && m.card
              ? `[カード: ${m.card.card.name} ${m.card.card.symbol} (${m.card.isReversed ? '逆位置' : '正位置'})]`
              : m.content,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        log('レスポンス受信');
        setSendError(null);

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
        log(`TTS開始: "${data.message.substring(0, 20)}..."`);
        playTTS(data.message);
      } else {
        const errorData = await response.json().catch(() => ({}));
        log('チャットAPIエラー: ' + (errorData.error || response.status));
        setSendError('送信に失敗しました。ネットワークを確認して再送してください。');
        setIsGeneratingAudio(false);
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        log('メッセージ送信が中断されました');
      } else {
        log('送信エラー: ' + (error as Error).message);
        setSendError('送信に失敗しました。ネットワークを確認して再送してください。');
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsSending(false);
        abortControllerRef.current = null;
      }
    }
  }, [messages, userId, isSending, log, stopTTS, playTTS]);

  // Save to Obsidian
  const handleSave = useCallback(async () => {
    if (messages.length === 0 || isSummarizing) return;

    setIsSummarizing(true);
    log('要約中...');

    try {
      // Step 1: Get summary from AI
      const summarizeResponse = await fetch('/api/journal/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          userId,
        }),
      });

      if (!summarizeResponse.ok) {
        log('要約失敗');
        pushNotice('error', '要約に失敗しました。少し時間を置いて再度お試しください。');
        return;
      }

      const summaryData = await summarizeResponse.json();
      log('要約完了: ' + summaryData.title);

      // Step 2: Save to Obsidian
      log('Obsidianに保存中...');
      const saveResponse = await fetch('/api/journal/save-to-obsidian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: summaryData.title,
          summary: summaryData.summary,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          userName: bootstrap.user?.callName || bootstrap.user?.name || 'わたし',
          aiName: bootstrap.identity?.name || 'ジョージ',
        }),
      });

      if (saveResponse.ok) {
        const saveData = await saveResponse.json();
        log('Obsidian保存完了: ' + saveData.filename);
        pushNotice('success', 'Obsidianに保存しました。');
      } else {
        const errorData = await saveResponse.json();
        log('Obsidian保存失敗: ' + (errorData.details || errorData.error));
        // alert('Obsidianへの保存に失敗しました。ダウンロードします。'); // Remove error alert

        // Fallback: Download file
        const dateStr = new Date().toISOString().split('T')[0];
        const markdownContent = `---
title: "${summaryData.title}"
date: ${dateStr}
tags:
  - tarot
  - journal
---

# ${summaryData.title}
**日付:** ${dateStr}

## 要約
${summaryData.summary}

## 対話履歴
${messages.map(m => `### ${m.role === 'user' ? (bootstrap.user?.callName || bootstrap.user?.name || 'わたし') : (bootstrap.identity?.name || 'ジョージ')}\n${m.content}`).join('\n\n')}
`;
        const blob = new Blob([markdownContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${dateStr}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Delay revoke to ensure download starts
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 1000);
        pushNotice('info', 'Obsidian保存に失敗したため、ファイルをダウンロードしました。');
      }
    } catch (error) {
      log('保存エラー: ' + (error as Error).message);
      pushNotice('error', '保存に失敗しました。通信状況をご確認ください。');
    } finally {
      setIsSummarizing(false);
    }
  }, [messages, isSummarizing, log, bootstrap, userId, pushNotice]);

  // Handle actual tarot draw after shuffle
  const processTarotDraw = useCallback(() => {
    setIsShuffleOpen(false);

    const card = drawRandomCard();
    const isReversed = Math.random() < 0.5;
    const drawnCard: DrawnCard = {
      card,
      position: isReversed ? 'reversed' : 'upright',
      isReversed
    };

    const tarotMessage: Message = {
      id: Date.now().toString(),
      role: 'tarot',
      content: '',
      timestamp: new Date(),
      card: drawnCard,
    };
    setMessages(prev => [...prev, tarotMessage]);

    // Send card info to AI
    const hour = new Date().getHours();
    const timeOfDay = (hour >= 5 && hour < 12) ? '朝' : '夜';
    const reflection = isReversed ? card.meaning.reversed : (
      (hour >= 5 && hour < 12) ? card.reflection.morning : card.reflection.evening
    );
    const positionText = isReversed ? '逆位置' : '正位置';
    const cardContext = `[タロットカードを引きました: ${card.name} ${card.symbol} - ${positionText}]\nキーワード: ${card.keywords.join('、')}\n問い: ${reflection}\n（${timeOfDay}のジャーナリングセッション）`;
    sendMessage(cardContext, false);
  }, [sendMessage]);

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

  // Share to native apps (Web Share API) - with user-friendly formatting
  const handleShare = useCallback(async () => {
    if (messages.length === 0) {
      pushNotice('info', '共有する内容がありません。');
      return;
    }

    log('共有用に整理中...');
    setIsSharing(true);
    pushNotice('info', '共有テキストを準備中...');

    try {
      // Step 1: Start the share process immediately if titles/text are ready
      // or at least call share with meaningful placeholders to satisfy the user gesture.
      // However, the best way in Safari is to have the text READY.
      // Let's try to fetch first, but with a timeout or fallback.

      const response = await fetch('/api/journal/format-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            card: m.card,
          })),
        }),
      });

      let shareTitle = '今日のジャーナル';
      let shareText = '';

      if (response.ok) {
        const data = await response.json();
        shareTitle = data.title || shareTitle;
        shareText = data.text || '';
      } else {
        shareText = messages.map(m => {
          const role = m.role === 'assistant' ? 'ジョージ' : (m.role === 'user' ? 'わたし' : '🎴');
          return `${role}: ${m.content}`;
        }).join('\n\n');
      }

      if (navigator.share) {
        try {
          await navigator.share({ title: shareTitle, text: shareText });
          pushNotice('success', '共有しました。');
        } catch (error) {
          console.error('navigator.share failed:', error);
          await navigator.clipboard.writeText(shareText);
          pushNotice('info', '共有メニューの起動に失敗したため、内容をコピーしました。');
        }
      } else {
        await navigator.clipboard.writeText(shareText);
        pushNotice('success', 'クリップボードにコピーしました。');
      }
    } catch (error) {
      console.error('handleShare error:', error);
      log('共有エラー: ' + (error as Error).message);
      pushNotice('error', '共有に失敗しました。通信状況をご確認ください。');
    } finally {
      setIsSharing(false);
    }
  }, [messages, log, pushNotice]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Push-to-talk: start on press
  const handleMicDown = (e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if ('type' in e && e.type === 'touchstart') {
      touchActiveRef.current = true;
    }
    if ('pointerType' in e && e.pointerType === 'mouse' && touchActiveRef.current) {
      return;
    }
    log('押した');

    if (!sttSupported) {
      pushNotice('error', 'このブラウザでは音声入力が使えません。', 5000);
      return;
    }

    if (isListening) return;

    // Prioritize microphone: Abort any pending message requests
    if (abortControllerRef.current) {
      log('マイク操作を優先するためAIへのリクエストを中断します');
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsSending(false);
    }

    stopTTS();
    unlockAudio();
    isHoldingMicRef.current = true;
    sendOnFinalRef.current = false;
    heldTranscriptRef.current = '';
    if (pendingSendTimerRef.current) {
      window.clearTimeout(pendingSendTimerRef.current);
      pendingSendTimerRef.current = null;
    }
    startListening();
    if (micRetryTimerRef.current) {
      window.clearTimeout(micRetryTimerRef.current);
    }
    micRetryTimerRef.current = window.setTimeout(() => {
      if (isHoldingMicRef.current && !isListeningRef.current) {
        startListening();
      }
    }, 600);
  };

  // Push-to-talk: send on release
  const handleMicUp = (e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if ('type' in e && e.type === 'touchend') {
      touchActiveRef.current = false;
    }
    if ('pointerType' in e && e.pointerType === 'mouse' && touchActiveRef.current) {
      return;
    }
    log('離した');
    isHoldingMicRef.current = false;
    if (micRetryTimerRef.current) {
      window.clearTimeout(micRetryTimerRef.current);
      micRetryTimerRef.current = null;
    }
    if (pendingSendTimerRef.current) {
      window.clearTimeout(pendingSendTimerRef.current);
      pendingSendTimerRef.current = null;
    }
    if (!isListening) {
      const toSend = `${heldTranscriptRef.current} ${currentTranscriptRef.current}`.trim();
      heldTranscriptRef.current = '';
      if (toSend.trim()) {
        sendMessage(toSend);
      }
      return;
    }
    sendOnFinalRef.current = true;
    stopAndSend();
    pendingSendTimerRef.current = window.setTimeout(() => {
      if (!sendOnFinalRef.current) return;
      sendOnFinalRef.current = false;
      const toSend = `${heldTranscriptRef.current} ${currentTranscriptRef.current}`.trim();
      heldTranscriptRef.current = '';
      if (toSend.trim()) {
        sendMessage(toSend);
      }
    }, 1200);
  };

  const handleMicCancel = (e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isListening) return;
    sendOnFinalRef.current = false;
    isHoldingMicRef.current = false;
    heldTranscriptRef.current = '';
    if (micRetryTimerRef.current) {
      window.clearTimeout(micRetryTimerRef.current);
      micRetryTimerRef.current = null;
    }
    if (pendingSendTimerRef.current) {
      window.clearTimeout(pendingSendTimerRef.current);
      pendingSendTimerRef.current = null;
    }
    cancel();
  };

  const visibleMessages = messages.length > MAX_RENDER_MESSAGES
    ? messages.slice(-MAX_RENDER_MESSAGES)
    : messages;
  const isMessagesTrimmed = messages.length > MAX_RENDER_MESSAGES;

  return (
    <main className="fixed inset-0 bg-black text-white overflow-hidden flex flex-col">
      {/* Tap-to-Start Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black z-[100] flex items-center justify-center"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-8 select-none px-8 max-w-sm"
            >
              {/* Loading hint before tap */}
              <AnimatePresence mode="wait">
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-6"
                >
                  {/* Simple loading bar or nothing to keep it clean */}
                  <div className="h-0.5 w-32 bg-white/10 overflow-hidden rounded-full">
                    {!prefersReducedMotion && (
                      <motion.div
                        animate={{ x: [-128, 128] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        className="h-full w-full bg-blue-500/50"
                      />
                    )}
                  </div>
                  <motion.p
                    animate={prefersReducedMotion ? { opacity: 0.7 } : { opacity: [0.3, 0.7, 0.3] }}
                    transition={prefersReducedMotion ? undefined : { repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                    className="text-white/50 font-light text-sm tracking-[0.2em] mt-4"
                  >
                    準備しています...
                  </motion.p>
                </motion.div>
              </AnimatePresence>

              {/* Tap button - delayed after checkin */}
              <AnimatePresence>
                {showTapHint && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8 }}
                    onClick={handleTapToStart}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      handleTapToStart();
                    }}
                    aria-label="タップして開始"
                    className="px-8 py-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 cursor-pointer active:bg-white/20 transition-colors"
                  >
                    <motion.p
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                      className="text-white/70 font-light tracking-widest text-sm"
                    >
                      タップして始める
                    </motion.p>
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Retry button when init failed */}
              {initError && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6 }}
                  onClick={() => prepareInBackground()}
                  className="px-6 py-2 rounded-full bg-white/5 border border-white/20 text-white/70 text-sm hover:bg-white/10 transition-colors"
                >
                  もう一度試す
                </motion.button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Aurora Glow Effect */}
      <GlowVisualizer isActive={!prefersReducedMotion && (isListening || isSending || isSpeaking)} />

      {/* Top Bar */}
      <div className="relative z-20 flex items-center justify-between px-4 py-3 safe-area-top min-h-[60px]">
        {/* Left: TTS Toggle */}
        <div className="flex-1 flex justify-start">
          <button
            onClick={() => setTtsEnabled(prev => !prev)}
            aria-label={ttsEnabled ? '音声をオフ' : '音声をオン'}
            className="p-2 text-white/50 hover:text-white transition-colors"
          >
            {ttsEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
        </div>

        {/* Center: Live Indicator */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 text-white/90">
          <div className="flex items-center gap-1">
            <motion.div
              animate={prefersReducedMotion ? { opacity: 0.8 } : (isListening || isSpeaking ? { opacity: [0.5, 1, 0.5] } : { opacity: 0.8 })}
              transition={prefersReducedMotion ? undefined : { repeat: Infinity, duration: 1.5 }}
              className="w-0.5 h-3 bg-white/80 rounded-full"
            />
            <motion.div
              animate={prefersReducedMotion ? { opacity: 0.6 } : (isListening || isSpeaking ? { opacity: [0.3, 0.8, 0.3] } : { opacity: 0.6 })}
              transition={prefersReducedMotion ? undefined : { repeat: Infinity, duration: 1.5, delay: 0.2 }}
              className="w-0.5 h-2 bg-white/60 rounded-full"
            />
            <motion.div
              animate={prefersReducedMotion ? { opacity: 0.8 } : (isListening || isSpeaking ? { opacity: [0.5, 1, 0.5] } : { opacity: 0.8 })}
              transition={prefersReducedMotion ? undefined : { repeat: Infinity, duration: 1.5, delay: 0.4 }}
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
            aria-label={showChat ? 'チャットを隠す' : 'チャットを表示'}
            className="p-2 text-white/50 hover:text-white transition-colors"
          >
            {showChat ? <ChevronDown size={22} /> : <MessageSquare size={22} />}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            aria-label="設定を開く"
            className="p-2 text-white/50 hover:text-white transition-colors"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        userId={userId}
        currentAiName={bootstrap.identity?.name || ''}
        currentUserName={bootstrap.user?.name || bootstrap.user?.callName || ''}
        currentVoiceId={bootstrap.identity?.voiceId || ''}
        currentShowDebug={bootstrap.identity?.showDebug || false}
        currentBgmEnabled={bootstrap.identity?.bgmEnabled || false}
        onSave={(settings) => {
          // Update local bootstrap state with new values
          if (settings.aiName || settings.voiceId || settings.showDebug !== undefined || settings.bgmEnabled !== undefined) {
            setBootstrap(prev => ({
              ...prev,
              identity: {
                ...(prev.identity || {}),
                name: settings.aiName || prev.identity?.name,
                voiceId: settings.voiceId || prev.identity?.voiceId,
                showDebug: settings.showDebug !== undefined ? settings.showDebug : prev.identity?.showDebug,
                bgmEnabled: settings.bgmEnabled !== undefined ? settings.bgmEnabled : prev.identity?.bgmEnabled
              }
            }));
          }
          if (settings.userName) {
            setBootstrap(prev => ({
              ...prev,
              user: {
                ...(prev.user || {}),
                name: settings.userName,
                callName: settings.userName
              }
            }));
          }
          log(`設定を保存しました: AI=${settings.aiName || '変更なし'}, User=${settings.userName || '変更なし'}, Voice=${settings.voiceId || '変更なし'}, Debug=${settings.showDebug !== undefined ? settings.showDebug : '変更なし'}, BGM=${settings.bgmEnabled !== undefined ? settings.bgmEnabled : '変更なし'}`);
        }}
      />

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
              {isMessagesTrimmed && (
                <div className="flex justify-center">
                  <div className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs">
                    古いメッセージは省略表示中です
                  </div>
                </div>
              )}
              {isPreparing && messages.length === 0 && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center gap-2">
                    <motion.div
                      animate={prefersReducedMotion ? undefined : { rotate: 360 }}
                      transition={prefersReducedMotion ? undefined : { repeat: Infinity, duration: 1, ease: "linear" }}
                      className="text-white/60"
                    >
                      <Loader2 size={16} />
                    </motion.div>
                    <span className="text-white/50 text-sm">準備しています...</span>
                  </div>
                </div>
              )}
              {notice && (
                <div className="flex justify-center">
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm border ${notice.type === 'success'
                      ? 'bg-green-500/20 border-green-500/30 text-green-100'
                      : notice.type === 'error'
                        ? 'bg-red-500/20 border-red-500/30 text-red-100'
                        : 'bg-white/10 border-white/20 text-white/80'
                      }`}
                  >
                    {notice.message}
                  </div>
                </div>
              )}
              {initError && (
                <div className="flex justify-center">
                  <div className="px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-white/80 text-sm flex items-center gap-3">
                    <span>{initError}</span>
                    <button
                      onClick={() => prepareInBackground()}
                      className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs"
                    >
                      再試行
                    </button>
                  </div>
                </div>
              )}
              {sendError && (
                <div className="flex justify-center">
                  <div className="px-4 py-3 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-100 text-sm flex items-center gap-3">
                    <span>{sendError}</span>
                    <button
                      onClick={() => sendMessage(lastSendTextRef.current)}
                      className="px-3 py-1 rounded-full bg-red-500/40 hover:bg-red-500/60 text-xs"
                    >
                      再送
                    </button>
                  </div>
                </div>
              )}
              {visibleMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'tarot' && msg.card ? (
                    // Tarot card inline display with reveal effect
                    <div className="w-full max-w-[280px]">
                      <TarotCardReveal drawnCard={msg.card} className="shadow-lg" />
                    </div>
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
                      animate={prefersReducedMotion ? undefined : { rotate: 360 }}
                      transition={prefersReducedMotion ? undefined : { repeat: Infinity, duration: 1, ease: "linear" }}
                      className="text-white/60"
                    >
                      <Loader2 size={16} />
                    </motion.div>
                    <span className="text-white/50 text-sm">返信を考えています...</span>
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
                      animate={prefersReducedMotion ? undefined : { scale: [1, 1.2, 1] }}
                      transition={prefersReducedMotion ? undefined : { repeat: Infinity, duration: 1 }}
                      className="text-white/40"
                    >
                      <Volume2 size={14} />
                    </motion.div>
                    <span className="text-white/40 text-xs">音声を準備中...</span>
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

      {/* Non-chat loading state */}
      {!showChat && messages.length === 0 && isPreparing && (
        <div className="flex-1 flex items-center justify-center z-10 px-8">
          <div className="px-4 py-3 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center gap-2">
            <motion.div
              animate={prefersReducedMotion ? undefined : { rotate: 360 }}
              transition={prefersReducedMotion ? undefined : { repeat: Infinity, duration: 1, ease: "linear" }}
              className="text-white/60"
            >
              <Loader2 size={16} />
            </motion.div>
            <span className="text-white/50 text-sm">準備しています...</span>
          </div>
        </div>
      )}

      {/* Non-chat status pill */}
      {!showChat && (isSending || sendError || initError || notice) && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-40 px-4">
          <div
            className={`px-4 py-2 rounded-full text-xs sm:text-sm border backdrop-blur-md ${sendError || initError
              ? 'bg-red-500/20 border-red-500/30 text-red-100'
              : notice?.type === 'success'
                ? 'bg-green-500/20 border-green-500/30 text-green-100'
                : notice?.type === 'error'
                  ? 'bg-red-500/20 border-red-500/30 text-red-100'
                  : 'bg-white/10 border-white/20 text-white/80'
              }`}
          >
            {isSending ? '送信中...' : sendError || initError || notice?.message}
          </div>
        </div>
      )}

      {/* Debug Log - Only visible when enabled in settings or in development by default */}
      {bootstrap.identity?.showDebug === true && (
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
              {(heldTranscriptRef.current ? `${heldTranscriptRef.current} ${currentTranscript}`.trim() : currentTranscript) || '押したまま話してください...'}
            </p>
          </motion.div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="relative z-20 p-4 safe-area-bottom pb-6">
        <div className="max-w-2xl mx-auto px-2">
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
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            {/* Tarot & Radio Section */}
            <div className="flex-1 flex justify-end items-center gap-3 sm:gap-4">
              <motion.button
                onClick={() => {
                  setShowRadio(true);
                  setRadioNotification(null);
                }}
                whileTap={{ scale: 0.95 }}
                title="Weekly Radio"
                aria-label="ウィークリーラジオを開く"
                className="p-4 rounded-full bg-white/10 backdrop-blur-sm text-gold-400 hover:bg-white/20 border border-gold-500/30 transition-all shadow-[0_0_15px_rgba(212,175,55,0.2)] relative"
              >
                <Radio size={24} />
                {radioNotification && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-black"
                  />
                )}
              </motion.button>
              <TarotDrawButton
                disabled={isSending || isListening || isShuffleOpen}
                onCardDrawn={() => setIsShuffleOpen(true)}
              />
            </div>

            <TarotDeckShuffle
              isOpen={isShuffleOpen}
              onCardSelected={processTarotDraw}
              onClose={() => setIsShuffleOpen(false)}
            />


            {/* Mic Button - Push to talk (Center) */}
            <motion.div className="relative">
              <AnimatePresence>
                {isListening && (
                  <>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={prefersReducedMotion ? { opacity: 0.25, scale: 1 } : {
                        opacity: [0, 0.4, 0],
                        scale: [1, 1.5, 1.8],
                      }}
                      transition={prefersReducedMotion ? undefined : {
                        repeat: Infinity,
                        duration: 1.5,
                        ease: "easeOut"
                      }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute inset-0 rounded-full bg-red-500 blur-xl"
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={prefersReducedMotion ? { opacity: 0.2, scale: 1 } : {
                        opacity: [0, 0.6, 0],
                        scale: [1, 1.3, 1.5],
                      }}
                      transition={prefersReducedMotion ? undefined : {
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
                onPointerDown={handleMicDown}
                onPointerUp={handleMicUp}
                onPointerCancel={handleMicCancel}
                onTouchStart={!supportsPointerEvents ? handleMicDown : undefined}
                onTouchEnd={!supportsPointerEvents ? handleMicUp : undefined}
                onMouseDown={!supportsPointerEvents ? handleMicDown : undefined}
                onMouseUp={!supportsPointerEvents ? handleMicUp : undefined}
                whileTap={{ scale: 0.95 }}
                disabled={!sttSupported}
                aria-label="マイクを押して話す"
                className={`p-5 sm:p-6 rounded-full transition-all select-none relative z-10 ${isListening
                  ? 'bg-red-500 text-white scale-110 shadow-lg shadow-red-500/40'
                  : 'bg-white/10 backdrop-blur-sm text-white/80 hover:bg-white/20 border border-white/10'
                  } ${!sttSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Mic size={28} className="sm:w-8 sm:h-8" />
              </motion.button>
            </motion.div>

            <div className="flex-1 flex justify-start gap-3 sm:gap-4">
              <motion.button
                onClick={handleSave}
                disabled={isSending || messages.length === 0 || isSummarizing}
                whileTap={{ scale: 0.95 }}
                title="要約して保存"
                aria-label="要約して保存"
                className={`p-3 sm:p-4 rounded-full bg-white/10 backdrop-blur-sm text-white/80 hover:bg-white/20 border border-white/10 transition-all ${isSending || messages.length === 0 ? 'opacity-20 cursor-not-allowed' : ''}`}
              >
                {isSummarizing ? (
                  <motion.div
                    animate={prefersReducedMotion ? undefined : { rotate: 360 }}
                    transition={prefersReducedMotion ? undefined : { repeat: Infinity, duration: 1, ease: "linear" }}
                  >
                    <Loader2 size={18} className="sm:w-6 sm:h-6" />
                  </motion.div>
                ) : (
                  <Download size={18} className="sm:w-6 sm:h-6" />
                )}
              </motion.button>
              <motion.button
                onClick={handleShare}
                disabled={isSending || isSharing || messages.length === 0}
                whileTap={{ scale: 0.95 }}
                title="スマホに共有"
                aria-label="共有する"
                className={`p-3 sm:p-4 rounded-full bg-white/10 backdrop-blur-sm text-white/80 hover:bg-white/20 border border-white/10 transition-all ${isSending || messages.length === 0 ? 'opacity-20 cursor-not-allowed' : ''}`}
              >
                {isSharing ? (
                  <motion.div
                    animate={prefersReducedMotion ? undefined : { rotate: 360 }}
                    transition={prefersReducedMotion ? undefined : { repeat: Infinity, duration: 1, ease: "linear" }}
                  >
                    <Loader2 size={18} className="sm:w-6 sm:h-6" />
                  </motion.div>
                ) : (
                  <Share2 size={18} className="sm:w-6 sm:h-6" />
                )}
              </motion.button>
            </div>

          </div>
        </div>
      </div>
      <audio
        ref={audioRef}
        onEnded={() => {
          setIsSpeaking(false);
          if (audioRef.current?.src && audioRef.current.src.startsWith('blob:')) {
            URL.revokeObjectURL(audioRef.current.src);
            audioRef.current.src = '';
          }
        }}
        onError={() => {
          setIsSpeaking(false);
          if (audioRef.current?.src && audioRef.current.src.startsWith('blob:')) {
            URL.revokeObjectURL(audioRef.current.src);
            audioRef.current.src = '';
          }
        }}
        style={{ display: 'none' }}
      />
      <audio
        ref={bgmRef}
        src="/audio/bar-bgm.mp3"
        loop
        style={{ display: 'none' }}
      />

      <GeorgeRadio
        isOpen={showRadio}
        onClose={() => setShowRadio(false)}
        userId={userId}
        userName={bootstrap.user?.name || bootstrap.user?.callName || ''}
        onGenerationComplete={(title) => {
          if (!showRadio) {
            setRadioNotification(title);
          }
        }}
      />

      {/* Radio Notification Toast */}
      <AnimatePresence>
        {radioNotification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => {
              setShowRadio(true);
              setRadioNotification(null);
            }}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[150] bg-gold-600/90 backdrop-blur-xl px-6 py-4 rounded-3xl border border-gold-400/30 shadow-2xl flex items-center gap-4 cursor-pointer active:scale-95 transition-transform"
          >
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Radio className="text-white" size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-white/60 tracking-widest uppercase">New Broadcast Ready</span>
              <span className="text-sm font-medium text-white truncate max-w-[150px]">{radioNotification}</span>
            </div>
            <motion.div
              animate={{ x: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="ml-2"
            >
              <ChevronDown className="-rotate-90 text-white/60" size={16} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main >
  );
}
