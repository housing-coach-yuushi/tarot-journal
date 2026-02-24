'use client';

import { useState, useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { Mic, MessageSquare, Send, ChevronDown, Volume2, VolumeX, Loader2, Download, RotateCcw, Settings, Share2 } from 'lucide-react';
import GlowVisualizer from '@/components/GlowVisualizer';
import TarotDrawButton from '@/components/TarotDrawButton';
import { useDeepgramStreamingSTT } from '@/hooks/useDeepgramStreamingSTT';
import { TarotCard, DrawnCard, drawRandomCard } from '@/lib/tarot/cards';
import { DEFAULT_VOICE_ID, getVoiceById } from '@/lib/tts/voices';
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
  userOnboarded?: boolean;
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

interface TurnPerfTrace {
  id: number;
  source: 'stt' | 'text' | 'retry' | 'system';
  startedAt: number;
  marks: Record<string, number>;
}

const CHECKIN_TTS_SESSION_KEY = 'tarot-journal:checkin-tts-handled';
const subscribeNoop = () => () => {};

function getPointerEventsSupport(): boolean {
  return typeof window !== 'undefined' && 'PointerEvent' in window;
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
  const supportsPointerEvents = useSyncExternalStore(subscribeNoop, getPointerEventsSupport, () => false);
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
  const [sendError, setSendError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [userId, setUserId] = useState<string>('default');
  const [showSettings, setShowSettings] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showTapHint, setShowTapHint] = useState(true);
  const [showRadio, setShowRadio] = useState(false);
  const [radioNotification, setRadioNotification] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const ttsVersionRef = useRef<number>(0); // Track latest TTS request version
  const [isShuffleOpen, setIsShuffleOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSendTextRef = useRef<string>('');
  const noticeTimerRef = useRef<number | null>(null);
  const ttsEnabledRef = useRef<boolean>(ttsEnabled);
  const checkinTtsPlayedRef = useRef<boolean>(false);
  const checkinTtsHandledRef = useRef<boolean>(false);
  const checkinTtsAttemptingRef = useRef<boolean>(false);
  const checkinTtsRetryTimerRef = useRef<number | null>(null);
  const checkinTtsAttemptedMessageIdRef = useRef<string | null>(null);
  const tapToStartBusyRef = useRef<boolean>(false);
  const prepareInFlightRef = useRef<boolean>(false);
  const suppressAudioErrorRef = useRef<boolean>(false);
  const audioElementPrimedRef = useRef<boolean>(false);
  const touchActiveRef = useRef<boolean>(false);
  const isHoldingMicRef = useRef<boolean>(false);
  const pendingMicReleaseRef = useRef<boolean>(false);
  const heldTranscriptRef = useRef<string>('');
  const turnPerfRef = useRef<TurnPerfTrace | null>(null);
  const turnPerfSeqRef = useRef<number>(0);
  const ttsChunkPrefetchRef = useRef<Promise<{ blob: Blob; contentType: string; text: string } | null> | null>(null);
  // checkin is shown directly in chat for new users
  const MAX_RENDER_MESSAGES = 80;
  const MAX_CHAT_HISTORY_MESSAGES = 24;
  const MAX_SUMMARY_MESSAGES = 40;
  const MAX_SHARE_MESSAGES = 40;
  const MAX_MESSAGE_CHARS = 1200;

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

  const nowMs = useCallback(() => {
    if (typeof window !== 'undefined' && typeof window.performance !== 'undefined') {
      return window.performance.now();
    }
    return Date.now();
  }, []);

  const beginTurnPerf = useCallback((source: TurnPerfTrace['source'], text: string) => {
    const id = ++turnPerfSeqRef.current;
    const startedAt = nowMs();
    turnPerfRef.current = {
      id,
      source,
      startedAt,
      marks: { start: startedAt },
    };
    const preview = text.trim().slice(0, 24);
    log(`[perf#${id}] start source=${source} len=${text.trim().length} "${preview}${text.trim().length > 24 ? '…' : ''}"`);
  }, [log, nowMs]);

  const markTurnPerf = useCallback((stage: string, meta?: string) => {
    const trace = turnPerfRef.current;
    if (!trace) return;
    const t = nowMs();
    trace.marks[stage] = t;
    const sinceStart = Math.round(t - trace.startedAt);
    const prevMarkTimes = Object.entries(trace.marks)
      .filter(([k]) => k !== stage)
      .map(([, v]) => v);
    const prev = prevMarkTimes.length > 0 ? Math.max(...prevMarkTimes) : trace.startedAt;
    const delta = Math.round(t - prev);
    log(`[perf#${trace.id}] ${stage} +${delta}ms / ${sinceStart}ms${meta ? ` ${meta}` : ''}`);
  }, [log, nowMs]);

  const endTurnPerf = useCallback((reason: string) => {
    const trace = turnPerfRef.current;
    if (!trace) return;
    const total = Math.round(nowMs() - trace.startedAt);
    log(`[perf#${trace.id}] end reason=${reason} total=${total}ms`);
    turnPerfRef.current = null;
  }, [log, nowMs]);

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

  const resolveUserId = useCallback((): string => {
    if (userId && userId !== 'default') return userId;
    const resolved = getUserId();
    if (resolved !== userId) {
      setUserId(resolved);
    }
    return resolved;
  }, [userId]);

  const fetchWithTimeout = useCallback(async (url: string, options?: RequestInit, timeoutMs = 12000) => {
    const controller = new AbortController();
    const id = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`request timeout (${timeoutMs}ms): ${url}`);
      }
      throw error;
    } finally {
      window.clearTimeout(id);
    }
  }, []);

  const truncateContent = useCallback((value: string, maxChars = MAX_MESSAGE_CHARS) => {
    const trimmed = value.trim();
    if (trimmed.length <= maxChars) return trimmed;
    return `${trimmed.slice(0, maxChars)}...`;
  }, [MAX_MESSAGE_CHARS]);

  const isSyntheticUiMessage = useCallback((message: Message) => {
    return (
      message.id.startsWith('checkin-')
      || message.id.startsWith('guide-')
      || message.id.startsWith('error-fallback-')
      || message.id.startsWith('onboarding-awake-')
      || message.id.startsWith('onboarding-user-')
      || message.id.startsWith('radio-notice-')
    );
  }, []);

  const notifyRadioReadyInChat = useCallback((title: string) => {
    const safeTitle = (title || '今週のジョージラジオ').trim();
    setRadioNotification(safeTitle);
    pushNotice('success', 'ジョージラジオの準備ができました。');

    const content = `ジョージラジオ「${safeTitle}」の準備ができたよ。下のラジオボタンから再生できます。`;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.id?.startsWith('radio-notice-') && last.content === content) {
        return prev;
      }
      return [
        ...prev,
        {
          id: `radio-notice-${Date.now()}`,
          role: 'assistant',
          content,
          timestamp: new Date(),
        },
      ];
    });
  }, [pushNotice]);

  const toHistoryPayload = useCallback((source: Message[]) => {
    return source
      .filter((m) => !isSyntheticUiMessage(m))
      .slice(-MAX_CHAT_HISTORY_MESSAGES)
      .map(m => ({
      role: m.role === 'tarot' ? 'user' : m.role,
      content: truncateContent(
        m.role === 'tarot' && m.card
          ? `[カード: ${m.card.card.name} ${m.card.card.symbol} (${m.card.isReversed ? '逆位置' : '正位置'})]`
          : m.content,
      ),
    }));
  }, [MAX_CHAT_HISTORY_MESSAGES, truncateContent, isSyntheticUiMessage]);

  const toSummaryPayload = useCallback((source: Message[]) => {
    return source
      .filter((m) => !isSyntheticUiMessage(m))
      .slice(-MAX_SUMMARY_MESSAGES)
      .map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: truncateContent(
        m.role === 'tarot' && m.card
          ? `[カード: ${m.card.card.name} ${m.card.card.symbol} (${m.card.isReversed ? '逆位置' : '正位置'})] ${m.content}`
          : m.content,
      ),
    }));
  }, [MAX_SUMMARY_MESSAGES, truncateContent, isSyntheticUiMessage]);

  const toSharePayload = useCallback((source: Message[]) => {
    return source
      .filter((m) => !isSyntheticUiMessage(m))
      .slice(-MAX_SHARE_MESSAGES)
      .map(m => ({
      role: m.role,
      content: truncateContent(m.content, 800),
      card: m.card,
    }));
  }, [MAX_SHARE_MESSAGES, truncateContent, isSyntheticUiMessage]);

  // Initialize userId on client side
  useEffect(() => {
    setUserId(getUserId());
  }, []);

  // Speech recognition hook - Deepgram Nova-3 streaming (real-time)
  const {
    isListening,
    finalizedTranscript,
    interimTranscript,
    inputLevel,
    isSupported: sttSupported,
    debugStatus,
    startListening,
    stopAndSend,
    cancel,
  } = useDeepgramStreamingSTT({
    lang: 'ja-JP',
    onFinalResult: (text: string) => {
      const finalText = text.trim();
      if (!finalText) return;
      beginTurnPerf('stt', finalText);
      markTurnPerf('stt_final');
      heldTranscriptRef.current = finalText;
      sendMessage(finalText, true, 'stt');
      heldTranscriptRef.current = '';
    },
    onError: (code, detail) => {
      log(`STT error [${code}]${detail ? ` ${detail}` : ''}`);
    },
  });

  useEffect(() => {
    if (debugStatus.startsWith('エラー:')) {
      const lower = debugStatus.toLowerCase();
      if (lower.includes('not-allowed') || lower.includes('service-not-allowed')) {
        pushNotice('error', 'マイクの許可が必要です。ブラウザ設定を確認してください。', 6000);
      } else if (lower.includes('audio-capture')) {
        pushNotice('error', 'マイクが見つかりません。接続状態をご確認ください。', 6000);
      } else if (lower.includes('aborted')) {
        pushNotice('info', '音声入力が中断されました。もう一度お試しください。', 4000);
      } else {
        pushNotice('error', '音声の変換に失敗しました。もう一度試してください。', 5000);
      }
    } else if (debugStatus === 'マイク許可が必要です') {
      pushNotice('error', 'マイクの許可が必要です。ブラウザ設定を確認してください。', 6000);
    } else if (debugStatus === 'マイクが見つかりません') {
      pushNotice('error', 'マイクが見つかりません。接続状態をご確認ください。', 6000);
    } else if (debugStatus === 'マイク利用エラー') {
      pushNotice('error', 'マイクが他のアプリで使用中の可能性があります。', 5000);
    } else if (debugStatus === 'トークン取得エラー') {
      pushNotice('error', '音声サーバーへの接続に失敗しました。時間をおいて再試行してください。', 6000);
    } else if (debugStatus === '接続エラー') {
      pushNotice('error', '音声認識の接続が不安定です。再度お試しください。', 5000);
    } else if (debugStatus === '接続タイムアウト') {
      pushNotice('error', '音声認識サーバーへの接続がタイムアウトしました。通信環境をご確認ください。', 6000);
    } else if (debugStatus === '音声初期化エラー') {
      pushNotice('error', '音声の初期化に失敗しました。ページ再読み込みをお試しください。', 6000);
    } else if (debugStatus === '変換エラー') {
      pushNotice('error', '音声の変換に失敗しました。もう一度試してください。', 5000);
    } else if (debugStatus === '音声が短すぎます') {
      pushNotice('info', '音声が短すぎます。もう少し長く話してください。', 4000);
    }
  }, [debugStatus, pushNotice]);

  useEffect(() => {
    if (!pendingMicReleaseRef.current) return;
    if (debugStatus !== '録音中') return;
    pendingMicReleaseRef.current = false;
    // Give the stream a brief moment to receive audio after the socket opens.
    window.setTimeout(() => {
      if (!isHoldingMicRef.current) {
        stopAndSend();
      }
    }, 180);
  }, [debugStatus, stopAndSend]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const speakWithBrowser = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onstart = () => markTurnPerf('browser_tts_onstart');
      utterance.onend = () => {
        markTurnPerf('browser_tts_onend');
        endTurnPerf('browser-tts-ended');
        setIsSpeaking(false);
      };
      utterance.onerror = () => {
        markTurnPerf('browser_tts_onerror');
        endTurnPerf('browser-tts-error');
        setIsSpeaking(false);
      };
      speechRef.current = utterance;
      setIsSpeaking(true);
      markTurnPerf('browser_tts_speak_call');
      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      return false;
    }
  }, [markTurnPerf, endTurnPerf]);

  const stopDeepgramTTS = useCallback(() => {
    // No-op: streaming WS playback was removed for stability.
  }, []);

  const splitTtsTextIntoChunks = useCallback((text: string): string[] => {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];

    const chunks: string[] = [];
    let buffer = '';
    const flush = () => {
      const value = buffer.replace(/\s+/g, ' ').trim();
      if (value) chunks.push(value);
      buffer = '';
    };

    for (const ch of normalized) {
      buffer += ch;
      if (/[。！？!?]/.test(ch)) {
        flush();
      } else if (ch === '\n' && buffer.trim().length > 0) {
        flush();
      }
    }
    flush();

    // Merge tiny trailing fragments to avoid choppy prosody.
    const merged: string[] = [];
    for (const chunk of chunks) {
      if (merged.length === 0) {
        merged.push(chunk);
        continue;
      }
      if (chunk.length < 8) {
        merged[merged.length - 1] = `${merged[merged.length - 1]} ${chunk}`.trim();
      } else {
        merged.push(chunk);
      }
    }

    return merged.length > 0 ? merged : [normalized];
  }, []);

  const unlockAudio = useCallback(async (): Promise<boolean> => {
    try {
      if (audioUnlocked && audioElementPrimedRef.current) return true;
      if (typeof window === 'undefined') return false;
      const unlockSrc = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';

      // Prime the actual playback element to satisfy strict mobile autoplay policies.
      const targetAudio = audioRef.current;
      if (targetAudio && !isSpeaking && !isGeneratingAudio) {
        const previousSrc = targetAudio.currentSrc || targetAudio.getAttribute('src') || '';
        suppressAudioErrorRef.current = true;
        targetAudio.setAttribute('playsinline', 'true');
        targetAudio.preload = 'auto';
        targetAudio.muted = false;
        targetAudio.volume = 0.001;
        targetAudio.src = unlockSrc;
        const p = targetAudio.play();
        if (p) {
          await p;
          targetAudio.pause();
          targetAudio.currentTime = 0;
        }
        if (previousSrc.startsWith('blob:')) {
          targetAudio.src = previousSrc;
        } else {
          targetAudio.removeAttribute('src');
          targetAudio.load();
        }
        window.setTimeout(() => {
          suppressAudioErrorRef.current = false;
        }, 180);
        audioElementPrimedRef.current = true;
      } else {
        const unlocker = new Audio(unlockSrc);
        unlocker.volume = 0.001;
        unlocker.muted = false;
        unlocker.preload = 'auto';
        unlocker.setAttribute('playsinline', 'true');
        const p = unlocker.play();
        if (p) {
          await p;
          unlocker.pause();
          unlocker.currentTime = 0;
        }
      }
      setAudioUnlocked(true);
      log('オーディオアンロック完了');
      return true;
    } catch (e) {
      // During non-gesture calls (e.g. async sends), this can fail on iOS.
      // Keep it as debug-only noise instead of a user-facing error.
      console.warn('[audio] unlock failed', e);
      return false;
    }
  }, [audioUnlocked, isGeneratingAudio, isSpeaking, log]);

  const fetchDeepgramTTSBlob = useCallback(async (
    text: string,
    version: number,
    voiceIdOverride?: string,
    chunkLabel?: string,
  ): Promise<{ blob: Blob; contentType: string; text: string } | null> => {
    if (typeof window === 'undefined') return null;
    markTurnPerf('tts_request_start', chunkLabel);
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voiceId: voiceIdOverride || DEFAULT_VOICE_ID,
      }),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      throw new Error(`TTS API error: ${response.status} ${details}`);
    }
    markTurnPerf('tts_response_headers', `${chunkLabel || ''} status=${response.status}`.trim());

    if (version !== ttsVersionRef.current) return null;

    const contentType = response.headers.get('content-type') || '';
    const audioBlob = await response.blob();
    if (version !== ttsVersionRef.current) return null;
    markTurnPerf('tts_blob_ready', `${chunkLabel || ''} ${audioBlob.size}b`.trim());
    log(`TTS blob${chunkLabel ? `(${chunkLabel})` : ''}: ${audioBlob.size} bytes (${contentType || 'unknown'})`);

    return { blob: audioBlob, contentType, text };
  }, [log, markTurnPerf]);

  const playDeepgramBlob = useCallback(async (
    payload: { blob: Blob; contentType: string },
    version: number,
  ) => {
    if (typeof window === 'undefined') return false;
    stopDeepgramTTS();
    if (version !== ttsVersionRef.current) return false;
    if (!audioRef.current) throw new Error('audio element missing');

    const nextUrl = URL.createObjectURL(payload.blob);
    const audio = audioRef.current;
    if (audio.src && audio.src.startsWith('blob:')) {
      URL.revokeObjectURL(audio.src);
    }

    // Keep direct HTMLAudioElement playback path.
    // AudioContext routing can become suspended on Safari/iOS and result in "playing but silent".

    audio.setAttribute('playsinline', 'true');
    audio.muted = false;
    audio.volume = 1;
    audio.playbackRate = 1;
    audio.preload = 'auto';
    audio.src = nextUrl;
    audio.currentTime = 0;
    setIsSpeaking(true);
    setIsGeneratingAudio(false);
    try {
      markTurnPerf('audio_play_call');
      await audio.play();
      markTurnPerf('audio_play_resolved');
      // Watchdog: on iOS/Safari, play() can resolve but audio stays stuck (no time progress).
      // Detect and retry once with an unlock attempt.
      await new Promise(resolve => window.setTimeout(resolve, 600));
      if (version !== ttsVersionRef.current) return false;
      const stuck = audio.paused || audio.currentTime <= 0;
      if (stuck) {
        log(`TTS stuck detected (paused=${audio.paused}, t=${audio.currentTime.toFixed(2)}, rs=${audio.readyState}, ns=${audio.networkState})`);
        const unlocked = await unlockAudio();
        if (version !== ttsVersionRef.current) return false;
        if (unlocked) {
          if (audio.src !== nextUrl) audio.src = nextUrl;
          audio.currentTime = 0;
          audio.muted = false;
          audio.volume = 1;
          audio.playbackRate = 1;
          markTurnPerf('audio_play_retry_call');
          await audio.play();
          markTurnPerf('audio_play_retry_resolved');
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const lowered = message.toLowerCase();
      if (lowered.includes('notallowed') || lowered.includes('gesture') || lowered.includes('interact')) {
        const unlocked = await unlockAudio();
        if (unlocked) {
          // Restore target source in case platform changed media state during unlock flow.
          if (audio.src !== nextUrl) {
            audio.src = nextUrl;
          }
          audio.currentTime = 0;
          audio.muted = false;
          audio.volume = 1;
          audio.playbackRate = 1;
          markTurnPerf('audio_play_retry_call');
          await audio.play();
          markTurnPerf('audio_play_retry_resolved');
        } else {
          throw new Error(`play blocked: ${message}`);
        }
      } else {
        throw error;
      }
    }
    return true;
  }, [stopDeepgramTTS, unlockAudio, log, markTurnPerf]);

  const waitForAudioSegmentEnd = useCallback(async (version: number): Promise<boolean> => {
    const audio = audioRef.current;
    if (!audio) return false;
    if (version !== ttsVersionRef.current) return false;

    await new Promise<void>((resolve) => {
      let settled = false;
      const cleanup = () => {
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
        if (watchdog !== null) {
          window.clearInterval(watchdog);
        }
      };
      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const onEnded = () => finish();
      const onError = () => finish();
      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);
      const watchdog = window.setInterval(() => {
        if (version !== ttsVersionRef.current) {
          finish();
        }
      }, 120);
    });

    return version === ttsVersionRef.current;
  }, []);

  const playDeepgramTTS = useCallback(async (text: string, version: number, voiceIdOverride?: string) => {
    const payload = await fetchDeepgramTTSBlob(text, version, voiceIdOverride);
    if (!payload) return false;
    return playDeepgramBlob(payload, version);
  }, [fetchDeepgramTTSBlob, playDeepgramBlob]);

  // Play TTS for a message (server-side Deepgram REST)
  const playTTS = useCallback(async (text: string): Promise<boolean> => {
    if (!ttsEnabled) {
      log('TTS無効');
      markTurnPerf('tts_skipped_disabled');
      return false;
    }

    log('音声生成開始...');
    markTurnPerf('tts_start');
    setIsGeneratingAudio(true);
    const currentVersion = ++ttsVersionRef.current;
    const rawVoiceId = bootstrap.identity?.voiceId;
    const selectedVoiceId = rawVoiceId && getVoiceById(rawVoiceId) ? rawVoiceId : DEFAULT_VOICE_ID;

    try {
      const chunks = splitTtsTextIntoChunks(text);
      log(`TTS chunking: ${chunks.length} chunk(s)`);

      if (chunks.length <= 1) {
        const ok = await playDeepgramTTS(text, currentVersion, selectedVoiceId);
        if (ok) return true;
        setIsGeneratingAudio(false);
        markTurnPerf('tts_no_playback');
        return false;
      }

      ttsChunkPrefetchRef.current = fetchDeepgramTTSBlob(
        chunks[0],
        currentVersion,
        selectedVoiceId,
        `1/${chunks.length}`,
      );

      for (let i = 0; i < chunks.length; i += 1) {
        const currentPromise = ttsChunkPrefetchRef.current || fetchDeepgramTTSBlob(
          chunks[i],
          currentVersion,
          selectedVoiceId,
          `${i + 1}/${chunks.length}`,
        );
        const payload = await currentPromise;
        ttsChunkPrefetchRef.current = null;
        if (!payload || currentVersion !== ttsVersionRef.current) {
          setIsGeneratingAudio(false);
          markTurnPerf('tts_sequence_cancelled');
          return false;
        }

        if (i + 1 < chunks.length) {
          ttsChunkPrefetchRef.current = fetchDeepgramTTSBlob(
            chunks[i + 1],
            currentVersion,
            selectedVoiceId,
            `${i + 2}/${chunks.length}`,
          );
        }

        const started = await playDeepgramBlob(payload, currentVersion);
        if (!started) {
          setIsGeneratingAudio(false);
          markTurnPerf('tts_no_playback');
          return false;
        }

        // Wait between chunks; final chunk can continue on existing audio events.
        if (i + 1 < chunks.length) {
          const finished = await waitForAudioSegmentEnd(currentVersion);
          if (!finished) {
            setIsGeneratingAudio(false);
            markTurnPerf('tts_sequence_interrupted');
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      const message = (error as Error).message || 'unknown';
      const lower = message.toLowerCase();
      const isPlaybackBlocked =
        message.includes('未初期化')
        || lower.includes('notallowed')
        || lower.includes('gesture')
        || lower.includes('play blocked');

      if (isPlaybackBlocked && checkinTtsAttemptingRef.current) {
        setIsGeneratingAudio(false);
        setIsSpeaking(false);
        log('チェックイン音声はユーザー操作待ち');
        return false;
      }

      const shortMessage = message.length > 90 ? `${message.slice(0, 90)}...` : message;
      log('音声再生失敗: ' + shortMessage);
      if (isPlaybackBlocked) {
        pushNotice('error', '音声再生を開始できませんでした。画面を一度タップしてから再試行してください。', 6000);
      }
      setIsGeneratingAudio(false);
      const fallbackOk = speakWithBrowser(text);
      markTurnPerf(fallbackOk ? 'tts_browser_fallback_ok' : 'tts_browser_fallback_failed');
      if (!fallbackOk) {
        setIsSpeaking(false);
      }
      return fallbackOk;
    }
  }, [ttsEnabled, log, playDeepgramTTS, fetchDeepgramTTSBlob, playDeepgramBlob, waitForAudioSegmentEnd, speakWithBrowser, bootstrap.identity?.voiceId, pushNotice, markTurnPerf, splitTtsTextIntoChunks]);

  // Stop TTS
  const stopTTS = useCallback(() => {
    const speechSynthesisActive = typeof window !== 'undefined'
      && 'speechSynthesis' in window
      && (window.speechSynthesis.speaking || window.speechSynthesis.pending);
    const hasActivePlayback = isSpeaking
      || isGeneratingAudio
      || speechSynthesisActive;
    if (hasActivePlayback) {
      log('音声停止');
    }
    ttsVersionRef.current++; // Invalidate any pending TTS fetches
    ttsChunkPrefetchRef.current = null;
    stopDeepgramTTS();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      const audio = audioRef.current;
      suppressAudioErrorRef.current = true;
      audio.pause();
      audio.currentTime = 0;
      const currentSrc = audio.currentSrc || audio.getAttribute('src') || '';
      if (currentSrc.startsWith('blob:')) {
        URL.revokeObjectURL(currentSrc);
      }
      // Avoid `src = ''` because some browsers resolve it to the page URL and emit a media error.
      audio.removeAttribute('src');
      audio.load();
      window.setTimeout(() => {
        suppressAudioErrorRef.current = false;
      }, 250);
    }
    setIsSpeaking(false);
    setIsGeneratingAudio(false);
  }, [isGeneratingAudio, isSpeaking, log, stopDeepgramTTS]);

  const buildCheckinMessages = useCallback((lines: string[]): Message[] => {
    const checkinMessage: Message = {
      id: `checkin-${Date.now()}`,
      role: 'assistant',
      content: lines.join('\n'),
      timestamp: new Date(),
    };
    const guideMessage: Message = {
      id: `guide-${Date.now()}`,
      role: 'assistant',
      content: 'マイクを押して、今の気持ちを話してみてください。',
      timestamp: new Date(),
    };
    return [checkinMessage, guideMessage];
  }, []);

  const buildOnboardingMessages = useCallback((status?: Partial<BootstrapState> | null): Message[] => {
    const isBootstrapped = status?.isBootstrapped === true;
    const userOnboarded = status?.userOnboarded === true;
    const aiName = status?.identity?.name || 'ジョージ';

    if (!isBootstrapped) {
      return [
        {
          id: `onboarding-awake-${Date.now()}`,
          role: 'assistant',
          content: '...。......。あ、れ......ここは？ 俺は......誰だ？……まずは、なんて呼べばいい？ マイクでもチャットでも大丈夫。',
          timestamp: new Date(),
        },
      ];
    }

    if (!userOnboarded) {
      return [
        {
          id: `onboarding-user-${Date.now()}`,
          role: 'assistant',
          content: `やあ、初めまして。俺は${aiName}。まずは、なんて呼べばいい？ マイクでもチャットでも大丈夫。`,
          timestamp: new Date(),
        },
      ];
    }

    return buildCheckinMessages(['自分と向き合う時間を始めます', '一緒にジャーナルをつけていきましょう', '心を静かにして...']);
  }, [buildCheckinMessages]);

  // Background: always show check-in first. Never restore previous history on app reopen.
  const prepareInBackground = useCallback(async () => {
    const fallbackLines = ['自分と向き合う時間を始めます', '一緒にジャーナルをつけていきましょう', '心を静かにして...'];
    if (prepareInFlightRef.current) {
      log('バックグラウンド準備は実行中のためスキップ');
      return;
    }
    prepareInFlightRef.current = true;
    try {
      log('バックグラウンド準備開始...');
      setIsPreparing(true);
      setIsReady(false);
      setInitError(null);
      checkinTtsPlayedRef.current = false;
      checkinTtsHandledRef.current = false;
      checkinTtsAttemptingRef.current = false;
      checkinTtsAttemptedMessageIdRef.current = null;
      if (checkinTtsRetryTimerRef.current) {
        window.clearTimeout(checkinTtsRetryTimerRef.current);
        checkinTtsRetryTimerRef.current = null;
      }

      const currentUserId = resolveUserId();
      setMessages(buildCheckinMessages(fallbackLines));
      log('チェックイン(フォールバック)を即表示');

      const [checkinResult, bootstrapResult] = await Promise.allSettled([
        (async () => {
          const res = await fetchWithTimeout(`/api/checkin?userId=${currentUserId}`, undefined, 10000);
          if (!res.ok) return null;
          const data = await res.json();
          return Array.isArray(data?.lines) ? data.lines.filter((line: unknown) => typeof line === 'string') : null;
        })(),
        (async () => {
          const res = await fetchWithTimeout(`/api/chat?userId=${currentUserId}&includeHistory=0`, undefined, 8000);
          if (!res.ok) return null;
          return res.json();
        })(),
      ]);

      if (checkinResult.status === 'fulfilled' && checkinResult.value && checkinResult.value.length > 0) {
        setMessages((prev) => {
          if (prev.length > 2) return prev;
          if (prev.some((m) => m.role === 'user' || m.role === 'tarot')) return prev;
          return buildCheckinMessages(checkinResult.value);
        });
        log('チェックイン文面を更新');
      } else if (checkinResult.status === 'rejected') {
        log(`チェックイン取得失敗: ${checkinResult.reason instanceof Error ? checkinResult.reason.message : String(checkinResult.reason)}`);
      }

      if (bootstrapResult.status === 'fulfilled' && bootstrapResult.value) {
        const nextStatus = bootstrapResult.value;
        setBootstrap((prev) => ({
          ...prev,
          isBootstrapped: nextStatus.isBootstrapped ?? prev.isBootstrapped,
          userOnboarded: nextStatus.userOnboarded ?? prev.userOnboarded,
          identity: nextStatus.identity ?? prev.identity,
          user: nextStatus.user ?? prev.user,
        }));

        const needsOnboarding = !nextStatus.isBootstrapped || !nextStatus.userOnboarded;
        if (needsOnboarding) {
          setMessages((prev) => {
            if (prev.some((m) => m.role === 'user' || m.role === 'tarot')) return prev;
            const nextMessages = buildOnboardingMessages(nextStatus);
            const nextFirst = nextMessages[0]?.id || '';
            const currentFirst = prev[0]?.id || '';
            const sameOnboardingKind =
              (currentFirst.startsWith('onboarding-awake-') && nextFirst.startsWith('onboarding-awake-'))
              || (currentFirst.startsWith('onboarding-user-') && nextFirst.startsWith('onboarding-user-'));
            if (sameOnboardingKind) return prev;
            return nextMessages;
          });
          log('新規ユーザー/未初期化のため、名前決めオンボーディングを表示');
          return;
        }
      } else if (bootstrapResult.status === 'rejected') {
        log(`ブートストラップ状態取得失敗: ${bootstrapResult.reason instanceof Error ? bootstrapResult.reason.message : String(bootstrapResult.reason)}`);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      log(`初期化エラー詳細: ${errMsg}`);
      setInitError('通信に失敗しました。再試行してください。');
    } finally {
      prepareInFlightRef.current = false;
      setIsReady(true);
      setIsPreparing(false);
      setIsGeneratingAudio(false);
    }
  }, [buildCheckinMessages, buildOnboardingMessages, fetchWithTimeout, log, resolveUserId]);

  useEffect(() => {
    prepareInBackground();
  }, [prepareInBackground]);

  const handleTapToStart = useCallback(async () => {
    if (tapToStartBusyRef.current) return;
    tapToStartBusyRef.current = true;
    try {
      setIsLoading(false);
      setShowTapHint(false);
      const unlocked = await unlockAudio();
      if (!unlocked) {
        pushNotice('info', '音声の準備は続行中です。必要ならマイクを押す前に画面を一度タップしてください。', 5000);
      }
    } finally {
      tapToStartBusyRef.current = false;
    }
  }, [unlockAudio, pushNotice]);

  useEffect(() => {
    if (isLoading || !isReady) return;
    if (messages.length > 2) return;
    if (messages.some(message => message.role === 'user' || message.role === 'tarot')) return;
    if (typeof window !== 'undefined' && window.sessionStorage.getItem(CHECKIN_TTS_SESSION_KEY) === '1') {
      checkinTtsHandledRef.current = true;
      return;
    }
    if (checkinTtsHandledRef.current) return;
    if (checkinTtsPlayedRef.current) return;
    if (checkinTtsAttemptingRef.current) return;
    if (!ttsEnabled) return;

    const firstMessage = messages[0];
    const isAutoTtsTarget = !!firstMessage && firstMessage.role === 'assistant' && (
      firstMessage.id.startsWith('checkin-')
      || firstMessage.id.startsWith('onboarding-awake-')
      || firstMessage.id.startsWith('onboarding-user-')
    );
    if (!isAutoTtsTarget) {
      return;
    }
    if (checkinTtsAttemptedMessageIdRef.current === firstMessage.id) {
      return;
    }
    const checkinText = firstMessage.content.trim();
    if (!checkinText) return;
    checkinTtsAttemptedMessageIdRef.current = firstMessage.id;
    checkinTtsHandledRef.current = true;
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(CHECKIN_TTS_SESSION_KEY, '1');
    }

    let canceled = false;
    const tryPlay = async () => {
      if (canceled || checkinTtsPlayedRef.current) return;
      checkinTtsAttemptingRef.current = true;
      log(firstMessage.id.startsWith('checkin-') ? 'チェックイン音声再生' : 'オンボーディング音声再生');
      const ok = await playTTS(checkinText);
      checkinTtsAttemptingRef.current = false;
      if (canceled) return;
      if (ok) {
        checkinTtsPlayedRef.current = true;
      } else {
        log(firstMessage.id.startsWith('checkin-') ? 'チェックイン音声再生失敗' : 'オンボーディング音声再生失敗');
      }
    };

    void tryPlay();
    return () => {
      canceled = true;
    };
  }, [isLoading, isReady, messages, playTTS, log, ttsEnabled]);

  useEffect(() => {
    return () => {
      if (checkinTtsRetryTimerRef.current) {
        window.clearTimeout(checkinTtsRetryTimerRef.current);
        checkinTtsRetryTimerRef.current = null;
      }
    };
  }, []);

  // Send message (visible in chat)
  const sendMessage = useCallback(async (
    text: string,
    showInChat: boolean = true,
    source: 'stt' | 'text' | 'retry' | 'system' = 'text',
  ) => {
    if (!text.trim()) return;
    if (!turnPerfRef.current) {
      beginTurnPerf(source, text);
    }
    markTurnPerf('send_enter');

    log(`メッセージ送信開始: ${text.substring(0, 10)}...`);
    setSendError(null);
    lastSendTextRef.current = text;
    checkinTtsHandledRef.current = true;
    checkinTtsPlayedRef.current = true;
    checkinTtsAttemptingRef.current = false;
    checkinTtsAttemptedMessageIdRef.current = '__disabled__';
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(CHECKIN_TTS_SESSION_KEY, '1');
    }
    unlockAudio();

    // Abort any existing request
    if (abortControllerRef.current) {
      log('以前のメッセージリクエストを中断します');
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsSending(true);
    const requestUserId = resolveUserId();

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
      markTurnPerf('chat_request_start');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          userId: requestUserId,
          history: toHistoryPayload(messages),
        }),
      });
      markTurnPerf('chat_response_headers', `status=${response.status}`);

      if (response.ok) {
        const data = await response.json();
        markTurnPerf('chat_response_body');
        log('レスポンス受信');
        setSendError(null);

        // Update bootstrap/onboarding state after every successful response.
        setBootstrap(prev => ({
          ...prev,
          isBootstrapped: data.isBootstrapped ?? prev.isBootstrapped,
          userOnboarded: data.userOnboarded ?? prev.userOnboarded,
          identity: data.identity ?? prev.identity,
          user: data.user ?? prev.user,
        }));

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        markTurnPerf('assistant_message_added');

        // Play TTS for response
        log(`TTS開始: "${data.message.substring(0, 20)}..."`);
        markTurnPerf('tts_dispatch');
        void playTTS(data.message).then((ok) => {
          if (!ok) {
            endTurnPerf('tts-not-played');
          }
        }).catch(() => {
          endTurnPerf('tts-error');
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        log('チャットAPIエラー: ' + (errorData.error || response.status));
        markTurnPerf('chat_error_response');
        setSendError('送信に失敗しました。ネットワークを確認して再送してください。');
        setIsGeneratingAudio(false);
        endTurnPerf('chat-error');
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        log('メッセージ送信が中断されました');
        markTurnPerf('chat_aborted');
        endTurnPerf('chat-aborted');
      } else {
        log('送信エラー: ' + (error as Error).message);
        markTurnPerf('chat_exception');
        setSendError('送信に失敗しました。ネットワークを確認して再送してください。');
        endTurnPerf('chat-exception');
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsSending(false);
        abortControllerRef.current = null;
      }
    }
  }, [messages, log, stopTTS, playTTS, unlockAudio, resolveUserId, toHistoryPayload, beginTurnPerf, markTurnPerf, endTurnPerf]);

  // Save to Obsidian
  const handleSave = useCallback(async () => {
    if (messages.length === 0 || isSummarizing) return;

    setIsSummarizing(true);
    log('要約中...');

    try {
      const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
      const requestUserId = resolveUserId();
      const summaryMessages = toSummaryPayload(messages);

      // Step 2: Download as markdown file
      const dateStr = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
      const useNamedSpeakers = bootstrap.isBootstrapped === true && bootstrap.userOnboarded === true;
      const userName = useNamedSpeakers ? (bootstrap.user?.callName || bootstrap.user?.name || 'わたし') : 'わたし';
      const aiName = useNamedSpeakers ? (bootstrap.identity?.name || 'ジョージ') : 'ジョージ';
      let title = `${dateStr}のジャーナル`;
      let summary = truncateContent(
        summaryMessages
          .slice(-6)
          .map((m) => `${m.role === 'assistant' ? aiName : userName}: ${m.content}`)
          .join(' / '),
        260,
      );
      let usedFallbackSummary = true;

      // Android Chrome can fail blob downloads after long async work because the user activation is lost.
      // Prefer fast fallback summary so the download starts immediately from the tap.
      if (!isAndroid) {
        try {
          const summarizeResponse = await fetchWithTimeout('/api/journal/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: summaryMessages,
              userId: requestUserId,
            }),
          }, 20000);

          if (summarizeResponse.ok) {
            const summaryData = await summarizeResponse.json();
            title = typeof summaryData?.title === 'string' && summaryData.title.trim() ? summaryData.title.trim() : title;
            summary = typeof summaryData?.summary === 'string' && summaryData.summary.trim() ? summaryData.summary.trim() : summary;
            usedFallbackSummary = false;
            log('要約完了: ' + title);
          } else {
            log(`要約失敗: ${summarizeResponse.status}`);
          }
        } catch (error) {
          log('要約フォールバック: ' + (error as Error).message);
        }
      } else {
        log('Android保存: 簡易要約で即ダウンロード');
      }

      const exportMessages = messages.slice(-Math.max(MAX_SUMMARY_MESSAGES, 60));

      const markdownContent = `---
title: "${title}"
date: ${dateStr}
time: ${timeStr}
tags:
  - tarot
  - journal
---

# ${title}

**日付:** ${dateStr} ${timeStr}

## 要約

${summary}

## 対話履歴

${exportMessages.map(m => {
  const speaker = m.role === 'assistant' ? aiName : m.role === 'tarot' ? `${userName}(カード)` : userName;
  const body = m.role === 'tarot' && m.card
    ? `[カード: ${m.card.card.name} ${m.card.card.symbol} (${m.card.isReversed ? '逆位置' : '正位置'})]\n${m.content || ''}`
    : m.content;
  return `### ${speaker}\n\n${body}`;
}).join('\n\n---\n\n')}
`;

      const filename = `${dateStr}-${timeStr}.md`;
      const blob = new Blob([markdownContent], { type: 'text/plain;charset=utf-8' });

      // Android: file-share is often more reliable than synthetic blob download.
      if (isAndroid) {
        let androidHandled = false;

        try {
          if (typeof File !== 'undefined' && navigator.share) {
            const file = new File([blob], filename, { type: 'text/plain' });
            const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
            const shareData: ShareData = { files: [file], title };
            if (!nav.canShare || nav.canShare(shareData)) {
              await navigator.share(shareData);
              androidHandled = true;
              log('Android保存: ファイル共有メニューを表示');
              pushNotice('success', '保存/共有メニューを開きました。');
            }
          }
        } catch (shareError) {
          if ((shareError as Error).name !== 'AbortError') {
            log('Android保存 share失敗: ' + (shareError as Error).message);
          }
        }

        if (!androidHandled) {
          try {
            await navigator.clipboard.writeText(markdownContent);
            androidHandled = true;
            log('Android保存: Markdownをクリップボードにコピー');
            pushNotice('info', '保存に失敗しやすい端末のため、Markdownをクリップボードにコピーしました。');
          } catch (clipError) {
            log('Android保存 clipboard失敗: ' + (clipError as Error).message);
          }
        }

        if (!androidHandled) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          log('Android保存: blobダウンロードを試行');
          pushNotice('info', 'ダウンロードを開始しました。');
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Delay revoke to ensure download starts
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 3000);

        log('ダウンロード完了');
        if (usedFallbackSummary) {
          pushNotice('info', '簡易要約でジャーナルをダウンロードしました。');
        } else {
          pushNotice('success', 'ジャーナルをダウンロードしました。');
        }
      }
    } catch (error) {
      log('保存エラー: ' + (error as Error).message);
      pushNotice('error', '保存に失敗しました。通信状況をご確認ください。');
    } finally {
      setIsSummarizing(false);
    }
  }, [
    messages,
    isSummarizing,
    log,
    bootstrap,
    pushNotice,
    resolveUserId,
    toSummaryPayload,
    truncateContent,
    fetchWithTimeout,
    MAX_SUMMARY_MESSAGES,
  ]);

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
    sendMessage(cardContext, false, 'system');
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
      const requestUserId = resolveUserId();
      const response = await fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: requestUserId, resetType }),
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
  }, [log, resolveUserId]);

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
      const requestUserId = resolveUserId();
      const userName = bootstrap.user?.callName || bootstrap.user?.name || 'わたし';
      const aiName = bootstrap.identity?.name || 'ジョージ';
      const compactMessages = toSharePayload(messages);
      const fallbackTitle = '今日のジャーナル';
      const fallbackText = compactMessages.map((m) => {
        if (m.role === 'assistant') return `${aiName}: ${m.content}`;
        if (m.role === 'tarot' && m.card) {
          return `${userName}(カード): [${m.card.card.name} ${m.card.card.symbol}] ${m.content}`;
        }
        return `${userName}: ${m.content}`;
      }).join('\n\n');

      if (navigator.share) {
        try {
          // Keep share immediate to preserve user activation (especially on iOS/PWA).
          await navigator.share({ title: fallbackTitle, text: fallbackText });
          pushNotice('success', '共有しました。');
        } catch (error: unknown) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            pushNotice('info', '共有をキャンセルしました。');
            return;
          }
          console.error('navigator.share failed:', error);
          try {
            await navigator.clipboard.writeText(fallbackText);
            pushNotice('info', '共有メニューの起動に失敗したため、内容をコピーしました。');
          } catch {
            pushNotice('error', '共有とコピーの両方に失敗しました。');
          }
        }
        return;
      }

      const response = await fetchWithTimeout('/api/journal/format-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: requestUserId,
          messages: compactMessages,
        }),
      }, 12000);

      let shareText = fallbackText;
      if (response.ok) {
        const data = await response.json();
        if (typeof data?.text === 'string' && data.text.trim()) {
          shareText = data.text.trim();
        }
      }

      try {
        await navigator.clipboard.writeText(shareText);
        pushNotice('success', 'クリップボードにコピーしました。');
      } catch {
        pushNotice('error', 'クリップボードへのコピーに失敗しました。');
      }
    } catch (error) {
      console.error('handleShare error:', error);
      log('共有エラー: ' + (error as Error).message);
      pushNotice('error', '共有に失敗しました。通信状況をご確認ください。');
    } finally {
      setIsSharing(false);
    }
  }, [messages, log, pushNotice, resolveUserId, bootstrap, toSharePayload, fetchWithTimeout]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input, true, 'text');
  };

  // Push-to-talk: start on press
  const handleMicDown = (e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if ('type' in e && e.type === 'touchstart') {
      touchActiveRef.current = true;
    }
    if ('pointerType' in e && e.pointerType === 'touch') {
      touchActiveRef.current = true;
    }
    if ('pointerType' in e && e.pointerType === 'mouse' && touchActiveRef.current) {
      return;
    }
    if (isHoldingMicRef.current) return;
    log('押した');
    pendingMicReleaseRef.current = false;

    if (!sttSupported) {
      pushNotice('error', 'このブラウザでは音声入力が使えません。', 5000);
      return;
    }

    if (isListening) return;

    // Once user starts talking, never allow checkin auto-TTS to run again in this session.
    checkinTtsHandledRef.current = true;
    checkinTtsPlayedRef.current = true;
    checkinTtsAttemptingRef.current = false;
    checkinTtsAttemptedMessageIdRef.current = '__disabled__';
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(CHECKIN_TTS_SESSION_KEY, '1');
    }

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
    heldTranscriptRef.current = '';
    startListening();
  };

  // Push-to-talk: send on release
  const handleMicUp = (e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if ('type' in e && e.type === 'touchend') {
      touchActiveRef.current = false;
    }
    if ('pointerType' in e && e.pointerType === 'touch') {
      touchActiveRef.current = false;
    }
    if ('pointerType' in e && e.pointerType === 'mouse' && touchActiveRef.current) {
      return;
    }
    log('離した');
    isHoldingMicRef.current = false;

    // First press often coincides with permission prompt / cold startup.
    // If the stream is still initializing, defer the release until STT becomes ready.
    if (debugStatus === 'マイク取得中' || debugStatus === '再接続中...') {
      pendingMicReleaseRef.current = true;
      log('STT準備中のため離し操作を保留');
      return;
    }

    // In native STT mode, stopAndSend dispatches the recognized text via onFinalResult.
    stopAndSend();
  };

  const handleMicCancel = (e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    // Pointer cancel can fire during permission dialogs or startup on mobile browsers.
    // Avoid treating that as a hard cancel before STT is fully ready.
    if (debugStatus === 'マイク取得中' || debugStatus === '再接続中...') {
      isHoldingMicRef.current = false;
      pendingMicReleaseRef.current = true;
      log('pointercancel(準備中) -> 離し保留');
      return;
    }
    if (!isListening) return;
    isHoldingMicRef.current = false;
    pendingMicReleaseRef.current = false;
    heldTranscriptRef.current = '';
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
            transition={{ duration: 0.45 }}
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[linear-gradient(160deg,#090b0e_0%,#12161e_55%,#080a0d_100%)]"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif' }}
          >
            <div className="pointer-events-none absolute inset-0">
              <motion.div
                animate={prefersReducedMotion ? undefined : { x: [0, 20, 0], y: [0, -12, 0] }}
                transition={prefersReducedMotion ? undefined : { duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-16 -left-10 h-64 w-64 rounded-full bg-white/20 blur-3xl"
              />
              <motion.div
                animate={prefersReducedMotion ? undefined : { x: [0, -18, 0], y: [0, 14, 0] }}
                transition={prefersReducedMotion ? undefined : { duration: 10, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -bottom-16 -right-12 h-72 w-72 rounded-full bg-slate-200/15 blur-3xl"
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.18),transparent_38%),radial-gradient(circle_at_80%_100%,rgba(151,181,255,0.16),transparent_42%)]" />
            </div>
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="relative mx-6 w-full max-w-md rounded-[32px] border border-white/30 bg-white/10 px-8 py-10 backdrop-blur-2xl shadow-[0_24px_90px_rgba(0,0,0,0.5)]"
            >
              <div className="mx-auto mb-7 h-1.5 w-14 rounded-full bg-white/45" />
              <div className="mb-7 text-center">
                <p className="text-[11px] font-medium tracking-[0.20em] text-white/60">GEORGE TAROT JOURNAL</p>
                <h1 className="mt-4 text-[26px] font-semibold tracking-[0.02em] text-white">
                  ジャーナルを始める
                </h1>
                <p className="mt-3 text-sm leading-relaxed tracking-[0.01em] text-white/68">
                  準備ができたら、下のボタンを押してください。
                </p>
              </div>

              {/* Tap-to-start primary action */}
              <AnimatePresence>
                {showTapHint && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6 }}
                    onPointerUp={() => void handleTapToStart()}
                    onTouchEnd={!supportsPointerEvents ? () => void handleTapToStart() : undefined}
                    onClick={() => void handleTapToStart()}
                    aria-label="タップして始める"
                    className="group relative w-full overflow-hidden rounded-full bg-white px-8 py-4 transition-all active:scale-[0.985]"
                  >
                    <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.95),rgba(242,246,255,0.9))]" />
                    <span className="pointer-events-none absolute inset-x-5 top-0 h-[1px] bg-white/90" />
                    <motion.p
                      animate={prefersReducedMotion ? undefined : { opacity: [0.85, 1, 0.85] }}
                      transition={prefersReducedMotion ? undefined : { repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                      className="relative text-base font-semibold tracking-[0.08em] text-slate-900"
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
                  className="mt-4 w-full rounded-full border border-white/25 bg-white/10 px-6 py-3 text-sm text-white/80 transition-colors hover:bg-white/15"
                >
                  もう一度試す
                </motion.button>
              )}

              <p className="mt-5 text-center text-[11px] tracking-[0.12em] text-white/55">
                AUDIO READY
              </p>
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
        currentShowDebug={showDebug}
        currentBgmEnabled={bootstrap.identity?.bgmEnabled || false}
        onSave={(settings) => {
          if (settings.showDebug !== undefined) {
            setShowDebug(settings.showDebug);
          }
          // Update local bootstrap state with new values
          if (settings.aiName || settings.voiceId || settings.showDebug !== undefined || settings.bgmEnabled !== undefined) {
            setBootstrap(prev => ({
              ...prev,
              identity: {
                ...(prev.identity || {}),
                name: settings.aiName || prev.identity?.name,
                voiceId: settings.voiceId || prev.identity?.voiceId,
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
                      onClick={() => sendMessage(lastSendTextRef.current, true, 'retry')}
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
              {isGeneratingAudio && (
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
      {showDebug === true && (
        <div className="absolute top-[65px] left-4 z-50 pointer-events-none max-w-[250px]">
          <div className="bg-black/60 backdrop-blur-md rounded-md p-2 font-mono text-[10px] sm:text-[12px] text-green-400 border border-green-500/20">
            <div className="flex gap-2 mb-1 border-b border-white/10 pb-1">
              <span className="opacity-70">STT:</span> <span>{sttSupported ? 'Y' : 'N'}</span>
              <span className="opacity-70 ml-2">State:</span> <span>{debugStatus}</span>
            </div>
            <div className="space-y-0.5">
              {debugLog.slice(-5).map((msg, i) => <div key={i} className="whitespace-pre-wrap break-words">{msg}</div>)}
            </div>
          </div>
        </div>
      )}

      {/* Listening indicator with current transcript */}
      {isListening && (
        <div className="absolute bottom-40 left-0 right-0 flex justify-center z-30 px-4">
          {(() => {
            const held = heldTranscriptRef.current.trim();
            const finalized = finalizedTranscript.trim();
            const interim = interimTranscript.trim();
            const finalText = [held, finalized].filter(Boolean).join(' ').trim();
            const bars = 14;
            return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 backdrop-blur-md rounded-2xl px-5 py-4 max-w-md w-full"
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-[11px] text-white/55 tracking-wide">聞き取り中</span>
              <div className="flex items-end gap-0.5 h-4" aria-hidden>
                {Array.from({ length: bars }).map((_, i) => {
                  const threshold = (i + 1) / bars;
                  const active = inputLevel >= threshold;
                  return (
                    <span
                      key={i}
                      className={`w-1 rounded-full transition-all duration-100 ${active ? 'bg-emerald-300/90' : 'bg-white/15'}`}
                      style={{ height: `${6 + (i % 5) * 2}px` }}
                    />
                  );
                })}
              </div>
            </div>
            <p className="text-sm text-center leading-relaxed min-h-[2.8rem]">
              {finalText ? <span className="text-white/90">{finalText}</span> : null}
              {finalText && interim ? <span className="text-white/50"> </span> : null}
              {interim ? <span className="text-white/45 italic">{interim}</span> : null}
              {!finalText && !interim ? (
                <span className="text-white/55">押したまま話してください...</span>
              ) : null}
            </p>
            <div className="mt-2 text-[11px] text-center text-white/45">
              {interim ? '薄い文字は変換途中です' : '話すとここに文字が出ます'}
            </div>
          </motion.div>
            );
          })()}
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
                className={`p-5 sm:p-6 rounded-full transition-all select-none relative z-10 touch-none ${isListening
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
        onPlay={() => {
          const audio = audioRef.current;
          if (!audio) return;
          markTurnPerf('audio_onPlay');
          log(`audio onPlay (t=${audio.currentTime.toFixed(2)}, rs=${audio.readyState}, ns=${audio.networkState})`);
        }}
        onPlaying={() => {
          const audio = audioRef.current;
          if (!audio) return;
          markTurnPerf('audio_onPlaying');
          log(`audio onPlaying (t=${audio.currentTime.toFixed(2)}, rs=${audio.readyState}, ns=${audio.networkState})`);
        }}
        onPause={() => {
          const audio = audioRef.current;
          if (!audio) return;
          // Avoid spam when stopTTS intentionally clears.
          if (suppressAudioErrorRef.current) return;
          log(`audio onPause (t=${audio.currentTime.toFixed(2)}, rs=${audio.readyState}, ns=${audio.networkState})`);
        }}
        onWaiting={() => {
          const audio = audioRef.current;
          if (!audio) return;
          log(`audio onWaiting (t=${audio.currentTime.toFixed(2)}, rs=${audio.readyState}, ns=${audio.networkState})`);
        }}
        onStalled={() => {
          const audio = audioRef.current;
          if (!audio) return;
          log(`audio onStalled (t=${audio.currentTime.toFixed(2)}, rs=${audio.readyState}, ns=${audio.networkState})`);
        }}
        onEnded={() => {
          setIsSpeaking(false);
          markTurnPerf('audio_onEnded');
          endTurnPerf('audio-ended');
          const audio = audioRef.current;
          if (!audio) return;
          const currentSrc = audio.currentSrc || audio.getAttribute('src') || '';
          if (currentSrc.startsWith('blob:')) {
            URL.revokeObjectURL(currentSrc);
          }
          audio.removeAttribute('src');
          audio.load();
        }}
        onError={() => {
          const audio = audioRef.current;
          if (!audio) {
            return;
          }
          const currentSrc = audio.currentSrc || audio.getAttribute('src') || '';
          const mediaErrorCode = audio.error?.code;
          if (
            suppressAudioErrorRef.current
            || !currentSrc
            || mediaErrorCode === MediaError.MEDIA_ERR_ABORTED
          ) {
            return;
          }
          log('音声要素エラー');
          markTurnPerf('audio_onError');
          endTurnPerf('audio-error');
          setIsSpeaking(false);
          if (currentSrc.startsWith('blob:')) {
            URL.revokeObjectURL(currentSrc);
          }
          audio.removeAttribute('src');
          audio.load();
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
            notifyRadioReadyInChat(title);
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
