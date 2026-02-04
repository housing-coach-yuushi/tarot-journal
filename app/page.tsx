'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MessageSquare, Send, ChevronDown, Volume2, VolumeX, Loader2, Download, RotateCcw, Settings, Share2 } from 'lucide-react';
import GlowVisualizer from '@/components/GlowVisualizer';
import TarotDrawButton from '@/components/TarotDrawButton';
import { TarotCardReveal } from '@/components/TarotCardReveal';
import { TarotDeckShuffle } from '@/components/TarotDeckShuffle';
import SettingsModal from '@/components/SettingsModal';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { TarotCard, DrawnCard, drawRandomCard } from '@/lib/tarot/cards';
import GeorgeRadio from '@/components/GeorgeRadio';
import { Radio } from 'lucide-react';

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
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


  // Initialize userId on client side
  useEffect(() => {
    setUserId(getUserId());
  }, []);

  // Show tap hint after checkin text has been visible for a moment
  useEffect(() => {
    if (!checkinLines) return;
    const timer = setTimeout(() => setShowTapHint(true), 5000);
    return () => clearTimeout(timer);
  }, [checkinLines]);


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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

        // Fetch checkin independently so it shows immediately
        fetchWithTimeout(`/api/checkin?userId=${currentUserId}`)
          .then(async (res) => {
            if (res.ok) {
              const data = await res.json();
              setCheckinLines(data.lines);
            }
          })
          .catch(() => { });

        // Fetch status and initial message in parallel
        const [statusRes, chatRes] = await Promise.all([
          fetchWithTimeout(`/api/chat?userId=${currentUserId}`),
          fetchWithTimeout('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: [], userId: currentUserId }),
          }),
        ]);
        log('ステータスと初期メッセージのレスポンスを受信しました');

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
          log(`初期メッセージ取得成功: "${messageText.substring(0, 20)}..."`);

          // Pre-fetch TTS audio
          if (messageText && ttsEnabled) {
            try {
              log('音声プリフェッチ中...');
              setIsGeneratingAudio(true);
              const ttsRes = await fetchWithTimeout('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: messageText }),
              }, 60000); // Wait up to 60s for pre-fetch

              if (ttsRes.ok) {
                const blob = await ttsRes.blob();
                if (blob.size > 0) {
                  audioUrl = URL.createObjectURL(blob);
                  log('音声プリフェッチ完了');
                } else {
                  log('音声プリフェッチ失敗: blob空');
                }
              } else {
                const errorData = await ttsRes.json().catch(() => ({}));
                log(`音声プリフェッチAPIエラー: ${errorData.details || errorData.error || ttsRes.status}`);
              }
            } catch (e) {
              log('プリフェッチ中断: ' + (e as Error).message);
            } finally {
              setIsGeneratingAudio(false);
            }
          }
        }

        // Store prepared data
        initDataRef.current = { message: messageText, audioUrl, status };
        log(`バックグラウンド準備完了: メッセージ="${messageText.substring(0, 10)}...", 音声=${!!audioUrl}`);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        log(`初期化エラー詳細: ${errMsg}`);
      } finally {
        setIsReady(true);
        setIsPreparing(false);
        setIsGeneratingAudio(false);
      }
    };

    prepareInBackground();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tap-to-start handler: unlock audio + show chat + play voice
  const handleTapToStart = useCallback(async () => {
    // Prevent double-tap
    if (!isLoading) return;
    setIsLoading(false);

    const data = initDataRef.current;

    // Unlock audio context with user gesture
    if (audioRef.current) {
      try {
        log('オーディオアンロック試行...');
        const audio = audioRef.current;
        audio.volume = 1.0;
        audio.muted = false;

        // If we have prepared audio, use it directly as the unlock gesture
        if (data?.audioUrl) {
          audio.src = data.audioUrl;
          audio.load();

          // Wait briefly for the blob to be "ready" to avoid 'play() request interrupted'
          let waitCount = 0;
          while (audio.readyState < 2 && waitCount < 20) {
            await new Promise(r => setTimeout(r, 50));
            waitCount++;
          }
          log(`準備済み音声セット (readyState: ${audio.readyState}, wait: ${waitCount * 50}ms)`);
        } else {
          audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
          audio.load();
        }

        const p = audio.play();
        if (p !== undefined) {
          if (data?.audioUrl) {
            setIsSpeaking(true);
            setIsGeneratingAudio(false);
          }
          p.then(() => {
            log(data?.audioUrl ? '初期音声再生開始成功' : '無音再生成功');
            if (!data?.audioUrl && audio.src.startsWith('data:audio/wav')) {
              audio.pause();
              audio.currentTime = 0;
            }
          }).catch(e => {
            // "Interrupted by new load" is normal if useEffect triggers fast
            if (e.name !== 'AbortedError' && e.name !== 'AbortError') {
              log('再生Promiseエラー: ' + e.message);
              if (data?.audioUrl) setIsSpeaking(false);
            }
          });
        }
      } catch (e) {
        log('アンロック例外: ' + (e as Error).message);
        setIsSpeaking(false);
      }
    }
    setAudioUnlocked(true);
    log('オーディオアンロック処理通過');

    if (data) {
      // Data is already ready - apply immediately
      initDataRef.current = null; // consume
      setBootstrap(data.status);

      if (data.message) {
        const initialMsg: Message = {
          id: 'initial-' + Date.now(),
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
        };
        setMessages([initialMsg]);

        if (data.message && ttsEnabled && !data.audioUrl) {
          log('プリフェッチ音声がないため、手動で再生を開始します');
          playTTS(data.message);
        }
      } else {
        log('初期メッセージがdata.messageにありません');
      }
    } else {
      // Data not ready yet - show chat and wait for background to finish
      log('データ準備中のままタップ。バックグラウンド完了待ち...');
      // Ensure the generating indicator is visible if we are still preparing
      if (isPreparing) {
        setIsGeneratingAudio(true);
      }
    }
  }, [isLoading, log, isPreparing]);

  // When background prep finishes after user already tapped, apply data
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
      } else if (data.message) {
        // Fallback to only initial awakening message if no history
        setMessages([{
          id: 'initial-' + Date.now(),
          role: 'assistant' as const,
          content: data.message,
          timestamp: new Date(),
        }]);

        // Play audio if unlocked
        if (data.audioUrl && audioRef.current && audioUnlocked) {
          audioRef.current.src = data.audioUrl;
          audioRef.current.load();
          setIsSpeaking(true);
          setIsGeneratingAudio(false);
          audioRef.current.play()
            .then(() => log('初期音声再生開始'))
            .catch(() => setIsSpeaking(false));
        } else if (data.message && audioUnlocked && ttsEnabled) {
          log('初期音声の手動再生を試みます...');
          playTTS(data.message);
        }
      }
    }
  }, [isReady, isLoading, audioUnlocked, log, ttsEnabled, playTTS]);

  // Send message (visible in chat)
  const sendMessage = useCallback(async (text: string, showInChat: boolean = true) => {
    if (!text.trim()) return;

    log(`メッセージ送信開始: ${text.substring(0, 10)}...`);

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
        setIsGeneratingAudio(false);
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        log('メッセージ送信が中断されました');
      } else {
        log('送信エラー: ' + (error as Error).message);
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
          userId: 'default',
        }),
      });

      if (!summarizeResponse.ok) {
        log('要約失敗');
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
        }),
      });

      if (saveResponse.ok) {
        const saveData = await saveResponse.json();
        log('Obsidian保存完了: ' + saveData.filename);
        alert(`✅ Obsidianに保存しました\n\n📁 ${saveData.filename}\n📝 ${summaryData.title}`);
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

        // Delay revoke to ensure download starts
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 1000);
      }
    } catch (error) {
      log('保存エラー: ' + (error as Error).message);
    } finally {
      setIsSummarizing(false);
    }
  }, [messages, isSummarizing, log]);

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
      alert('共有する内容がありません');
      return;
    }

    log('共有用に整理中...');

    try {
      // Call the format-share API to get user-friendly formatted text
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

      let title = '今日のジャーナル';
      let text = '';

      if (response.ok) {
        const data = await response.json();
        title = data.title || title;
        text = data.text || '';
        log('共有用テキスト生成完了');
      } else {
        // Fallback: raw conversation
        log('整理に失敗、元のテキストを使用');
        text = messages.map(m => {
          const role = m.role === 'assistant' ? 'ジョージ' : (m.role === 'user' ? 'わたし' : '🎴');
          return `${role}: ${m.content}`;
        }).join('\n\n');
      }

      if (navigator.share) {
        try {
          await navigator.share({ title, text });
          log('共有メニューを表示しました');
        } catch (error) {
          if ((error as Error).name !== 'AbortError') {
            log('共有エラー: ' + (error as Error).message);
          }
        }
      } else {
        // Fallback: Copy to clipboard
        try {
          await navigator.clipboard.writeText(text);
          alert('クリップボードにコピーしました！\nジャーナルアプリなどに貼り付けてください。');
          log('クリップボードにコピー');
        } catch (err) {
          log('コピー失敗');
        }
      }
    } catch (error) {
      log('共有準備エラー: ' + (error as Error).message);
      alert('共有の準備に失敗しました');
    }
  }, [messages, log]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Push-to-talk: start on press
  const handleMicDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    log('押した');

    // Prioritize microphone: Abort any pending message requests
    if (abortControllerRef.current) {
      log('マイク操作を優先するためAIへのリクエストを中断します');
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsSending(false);
    }

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
              {/* Checkin words */}
              <AnimatePresence mode="wait">
                {checkinLines ? (
                  <motion.div
                    key="checkin"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="flex flex-col items-center gap-2 text-center"
                  >
                    {checkinLines.map((line, i) => (
                      <p
                        key={i}
                        className={
                          i === checkinLines.length - 1
                            ? 'text-white/90 font-light text-lg leading-relaxed tracking-wider'
                            : 'text-white/60 font-light text-base leading-relaxed tracking-wide'
                        }
                      >
                        {line}
                      </p>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-6"
                  >
                    {/* Simple loading bar or nothing to keep it clean */}
                    <div className="h-0.5 w-32 bg-white/10 overflow-hidden rounded-full">
                      <motion.div
                        animate={{ x: [-128, 128] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        className="h-full w-full bg-blue-500/50"
                      />
                    </div>
                    <motion.p
                      animate={{ opacity: [0.3, 0.7, 0.3] }}
                      transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                      className="text-white/50 font-light text-sm tracking-[0.2em] mt-4"
                    >
                      目覚めています...
                    </motion.p>
                  </motion.div>
                )}
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
            </motion.div>
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
              {messages.map((msg) => (
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
            {/* Tarot & Radio Section */}
            <div className="flex-1 flex justify-end items-center gap-4">
              <motion.button
                onClick={() => {
                  setShowRadio(true);
                  setRadioNotification(null);
                }}
                whileTap={{ scale: 0.95 }}
                title="Weekly Radio"
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
                onTouchStart={handleMicDown}
                onTouchEnd={handleMicUp}
                whileTap={{ scale: 0.95 }}
                disabled={!sttSupported}
                className={`p-6 rounded-full transition-all select-none relative z-10 ${isListening
                  ? 'bg-red-500 text-white scale-110 shadow-lg shadow-red-500/40'
                  : 'bg-white/10 backdrop-blur-sm text-white/80 hover:bg-white/20 border border-white/10'
                  } ${!sttSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Mic size={32} />
              </motion.button>
            </motion.div>

            <div className="flex-1 flex justify-start gap-4">
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
              <motion.button
                onClick={handleShare}
                disabled={isSending || messages.length === 0}
                whileTap={{ scale: 0.95 }}
                title="スマホに共有"
                className={`p-4 rounded-full bg-white/10 backdrop-blur-sm text-white/80 hover:bg-white/20 border border-white/10 transition-all ${isSending || messages.length === 0 ? 'opacity-20 cursor-not-allowed' : ''}`}
              >
                <Share2 size={24} />
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
