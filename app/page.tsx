'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { ChevronDown, Radio } from 'lucide-react';

import GlowVisualizer from '@/components/GlowVisualizer';
import TapToStart from '@/components/TapToStart';
import TopBar from '@/components/TopBar';
import ChatArea from '@/components/ChatArea';
import BottomControls from '@/components/BottomControls';

import { useTTS } from '@/hooks/useTTS';
import { useChat, Message } from '@/hooks/useChat';
import { useTarot } from '@/hooks/useTarot';
import { useNotice } from '@/hooks/useNotice';
import { useBootstrap } from '@/hooks/useBootstrap';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

const SettingsModal = dynamic(() => import('@/components/SettingsModal').then(m => m.default), { ssr: false });
const GeorgeRadio = dynamic(() => import('@/components/GeorgeRadio').then(m => m.default), { ssr: false });

const CHECKIN_TTS_SESSION_KEY = 'tarot-journal:checkin-tts-handled';

function getUserId(): string {
  if (typeof window === 'undefined') return 'default';
  const stored = localStorage.getItem('tarot-journal-user-id');
  if (stored) return stored;
  const newId = 'user-' + crypto.randomUUID();
  localStorage.setItem('tarot-journal-user-id', newId);
  return newId;
}

export default function Home() {
  const [userId, setUserId] = useState<string>('default');
  const [isLoading, setIsLoading] = useState(true);
  const [showTapHint, setShowTapHint] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showRadio, setShowRadio] = useState(false);
  const [radioNotification, setRadioNotification] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [checkinLines, setCheckinLines] = useState<string[] | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const checkinTtsPlayedRef = useRef<boolean>(false);
  const hasHistoryRef = useRef<boolean>(false);
  const isHoldingMicRef = useRef<boolean>(false);
  const heldTranscriptRef = useRef<string>('');

  // Hooks
  const { notice, pushNotice, clearNotice } = useNotice();
  const { bootstrap, setBootstrap, updateIdentity, updateUser } = useBootstrap();

  const log = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    setDebugLog(prev => [...prev.slice(-20), `[${timestamp}] ${msg}`]);
  }, []);

  const {
    isSpeaking,
    isGeneratingAudio,
    ttsEnabled,
    setTtsEnabled,
    playTTS,
    stopTTS,
    unlockAudio,
    audioUnlocked,
    audioRef,
  } = useTTS({
    voiceId: bootstrap.identity?.voiceId,
    onLog: log,
    onNotice: pushNotice,
  });

  const {
    messages,
    isSending,
    sendError,
    setMessages,
    sendMessage: sendChatMessage,
    loadHistory,
    abortControllerRef,
    lastSendTextRef,
  } = useChat({
    userId,
    onLog: log,
    onError: (error) => pushNotice('error', error),
    onBootstrapUpdate: (data) => {
      if (data.identity && typeof data.identity === 'object') {
        updateIdentity(data.identity as Parameters<typeof updateIdentity>[0]);
      }
      if (data.user && typeof data.user === 'object') {
        updateUser(data.user as Parameters<typeof updateUser>[0]);
      }
      if (data.isBootstrapped !== undefined) {
        setBootstrap(prev => ({ ...prev, isBootstrapped: data.isBootstrapped as boolean }));
      }
    },
  });

  const { isShuffleOpen, setIsShuffleOpen, processTarotDraw } = useTarot({
    onCardDrawn: (card, context) => {
      const tarotMessage: Message = {
        id: Date.now().toString(),
        role: 'tarot',
        content: '',
        timestamp: new Date(),
        card: card,
      };
      setMessages(prev => [...prev, tarotMessage]);
      sendChatMessage(context, false);
    },
  });

  const {
    isListening,
    currentTranscript,
    isSupported: sttSupported,
    debugStatus,
    startListening,
    stopAndSend,
    cancel,
  } = useSpeechRecognition({
    lang: 'ja-JP',
    onFinalResult: (text: string) => {
      const finalText = text.trim();
      if (!finalText) return;
      heldTranscriptRef.current = finalText;
      handleSendMessage(finalText);
      heldTranscriptRef.current = '';
    },
  });

  // Initialize userId
  useEffect(() => {
    setUserId(getUserId());
  }, []);

  // BGM playback control
  useEffect(() => {
    if (!bgmRef.current) return;
    const isEnabled = bootstrap.identity?.bgmEnabled === true;
    if (isEnabled && audioUnlocked) {
      bgmRef.current.play().catch(e => console.warn(`BGM play failed: ${e}`));
      bgmRef.current.volume = 0.005;
    } else {
      bgmRef.current.pause();
    }
  }, [bootstrap.identity?.bgmEnabled, audioUnlocked]);

  // STT error handling
  useEffect(() => {
    if (debugStatus.startsWith('エラー:') || debugStatus.includes('許可') || debugStatus.includes('見つかり')) {
      pushNotice('error', debugStatus, 6000);
    }
  }, [debugStatus, pushNotice]);

  // Background preparation
  const prepareInBackground = useCallback(async () => {
    try {
      log('バックグラウンド準備開始...');
      setInitError(null);
      checkinTtsPlayedRef.current = false;

      const currentUserId = getUserId();
      setUserId(currentUserId);

      // Fetch status
      const statusRes = await fetch(`/api/chat?userId=${currentUserId}`);
      const status = await statusRes.json();
      setBootstrap(status);

      if (status?.history && status.history.length > 0) {
        hasHistoryRef.current = true;
        const restoredMessages: Message[] = status.history.map((m: { role: string; content: string; timestamp?: string }, i: number) => ({
          id: `restored-${i}-${Date.now()}`,
          role: m.role as Message['role'],
          content: m.content,
          timestamp: new Date(m.timestamp || Date.now()),
        }));
        setMessages(restoredMessages);
        log(`履歴復元: ${status.history.length}件`);
      } else {
        // Fetch checkin lines
        try {
          const res = await fetch(`/api/checkin?userId=${currentUserId}`);
          if (res.ok) {
            const data = await res.json();
            setCheckinLines(data.lines);
          }
        } catch {
          // ignore
        }

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
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      log(`初期化エラー: ${errMsg}`);
      setInitError('通信に失敗しました。再試行してください。');
    } finally {
      setIsLoading(false);
    }
  }, [log, setBootstrap, setMessages, checkinLines]);

  useEffect(() => {
    prepareInBackground();
  }, [prepareInBackground]);

  // Checkin TTS
  useEffect(() => {
    if (isLoading) return;
    if (hasHistoryRef.current) return;
    if (messages.length > 2) return;
    if (typeof window !== 'undefined' && window.sessionStorage.getItem(CHECKIN_TTS_SESSION_KEY) === '1') return;
    if (checkinTtsPlayedRef.current || !ttsEnabled) return;

    const firstMessage = messages[0];
    if (!firstMessage || firstMessage.role !== 'assistant' || !firstMessage.id.startsWith('checkin-')) return;

    window.sessionStorage.setItem(CHECKIN_TTS_SESSION_KEY, '1');
    checkinTtsPlayedRef.current = true;

    const tryPlay = async () => {
      log('チェックイン音声再生');
      await playTTS(firstMessage.content.trim());
    };

    void tryPlay();
  }, [isLoading, messages, playTTS, log, ttsEnabled]);

  // Handlers
  const handleTapToStart = useCallback(async () => {
    setIsLoading(false);
    setShowTapHint(false);
    await unlockAudio();
  }, [unlockAudio]);

  const handleSendMessage = useCallback(async (text: string) => {
    window.sessionStorage.setItem(CHECKIN_TTS_SESSION_KEY, '1');
    checkinTtsPlayedRef.current = true;
    setInput('');
    stopTTS();
    await sendChatMessage(text);
  }, [sendChatMessage, stopTTS]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      handleSendMessage(input);
    }
  };

  const handleMicDown = useCallback((e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (isHoldingMicRef.current || !sttSupported || isListening) return;

    window.sessionStorage.setItem(CHECKIN_TTS_SESSION_KEY, '1');
    checkinTtsPlayedRef.current = true;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    stopTTS();
    unlockAudio();
    isHoldingMicRef.current = true;
    heldTranscriptRef.current = '';
    startListening();
  }, [sttSupported, isListening, abortControllerRef, stopTTS, unlockAudio, startListening]);

  const handleMicUp = useCallback((e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    isHoldingMicRef.current = false;
    stopAndSend();
  }, [stopAndSend]);

  const handleMicCancel = useCallback((e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isListening) return;
    isHoldingMicRef.current = false;
    heldTranscriptRef.current = '';
    cancel();
  }, [isListening, cancel]);

  const handleSave = useCallback(async () => {
    if (messages.length === 0) return;

    pushNotice('info', '要約中...');
    setIsSummarizing(true);
    try {
      const summarizeResponse = await fetch('/api/journal/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          userId,
        }),
      });

      if (!summarizeResponse.ok) {
        pushNotice('error', '要約に失敗しました。');
        return;
      }

      const summaryData = await summarizeResponse.json();
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
        pushNotice('success', 'Obsidianに保存しました。');
      } else {
        pushNotice('info', 'Obsidian保存に失敗したため、ファイルをダウンロードしました。');
      }
    } catch (error) {
      pushNotice('error', '保存に失敗しました。');
    } finally {
      setIsSummarizing(false);
    }
  }, [messages, userId, bootstrap, pushNotice]);

  const handleShare = useCallback(async () => {
    if (messages.length === 0) {
      pushNotice('info', '共有する内容がありません。');
      return;
    }

    setIsSharing(true);
    try {
      const response = await fetch('/api/journal/format-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content, card: m.card })),
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
        await navigator.share({ title: shareTitle, text: shareText });
        pushNotice('success', '共有しました。');
      } else {
        await navigator.clipboard.writeText(shareText);
        pushNotice('success', 'クリップボードにコピーしました。');
      }
    } catch (error) {
      pushNotice('error', '共有に失敗しました。');
    } finally {
      setIsSharing(false);
    }
  }, [messages, pushNotice]);

  return (
    <main className="fixed inset-0 bg-black text-white overflow-hidden flex flex-col">
      {/* Tap-to-start overlay */}
      <TapToStart
        isLoading={isLoading}
        isPreparing={false}
        initError={initError}
        showTapHint={showTapHint}
        onTap={handleTapToStart}
        onRetry={prepareInBackground}
      />

      {/* Aurora Glow */}
      <GlowVisualizer isActive={isListening || isSending || isSpeaking} />

      {/* Top Bar */}
      <TopBar
        ttsEnabled={ttsEnabled}
        onToggleTts={() => setTtsEnabled(!ttsEnabled)}
        showChat={showChat}
        onToggleChat={() => setShowChat(!showChat)}
        onOpenSettings={() => setShowSettings(true)}
        aiName={bootstrap.identity?.name}
        isListening={isListening}
        isSpeaking={isSpeaking}
      />

      {/* Settings Modal */}
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
          if (settings.aiName) updateIdentity({ name: settings.aiName });
          if (settings.voiceId) updateIdentity({ voiceId: settings.voiceId });
          if (settings.showDebug !== undefined) updateIdentity({ showDebug: settings.showDebug });
          if (settings.bgmEnabled !== undefined) updateIdentity({ bgmEnabled: settings.bgmEnabled });
          if (settings.userName) updateUser({ name: settings.userName, callName: settings.userName });
          log('設定を保存しました');
        }}
      />

      {/* Chat Area */}
      <ChatArea
        messages={messages}
        isSending={isSending}
        isGeneratingAudio={isGeneratingAudio}
        showChat={showChat}
        notice={notice}
        initError={initError}
        sendError={sendError}
        onRetry={prepareInBackground}
        onResend={handleSendMessage}
        lastSendText={lastSendTextRef.current}
        userName={bootstrap.user?.callName || bootstrap.user?.name}
        aiName={bootstrap.identity?.name}
      />

      {/* Debug Log */}
      {bootstrap.identity?.showDebug === true && (
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

      {/* Non-chat status pill */}
      {!showChat && (isSending || sendError || initError || notice) && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-40 px-4">
          <div className="px-4 py-2 rounded-full text-xs sm:text-sm border backdrop-blur-md bg-white/10 border-white/20 text-white/80">
            {isSending ? '送信中...' : sendError || initError || notice?.message}
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      <BottomControls
        input={input}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        isSending={isSending}
        isListening={isListening}
        messages={messages}
        isSummarizing={isSummarizing}
        isSharing={isSharing}
        sttSupported={sttSupported}
        currentTranscript={currentTranscript}
        heldTranscript={heldTranscriptRef.current}
        isShuffleOpen={isShuffleOpen}
        onMicDown={handleMicDown}
        onMicUp={handleMicUp}
        onMicCancel={handleMicCancel}
        onSave={handleSave}
        onShare={handleShare}
        onOpenRadio={() => {
          setShowRadio(true);
          setRadioNotification(null);
        }}
        onOpenShuffle={() => setIsShuffleOpen(true)}
        onCloseShuffle={() => setIsShuffleOpen(false)}
        onCardSelected={processTarotDraw}
        radioNotification={radioNotification}
      />

      {/* Audio elements */}
      <audio ref={audioRef} style={{ display: 'none' }} />
      <audio ref={bgmRef} src="/audio/bar-bgm.mp3" loop style={{ display: 'none' }} />

      {/* George Radio */}
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
    </main>
  );
}
