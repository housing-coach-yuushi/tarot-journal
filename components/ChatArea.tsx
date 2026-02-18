'use client';

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Loader2, Volume2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Message } from '@/hooks/useChat';

const TarotCardReveal = dynamic(() => import('@/components/TarotCardReveal').then(m => m.TarotCardReveal), {
  ssr: false,
});

interface Notice {
  type: 'info' | 'success' | 'error';
  message: string;
}

interface ChatAreaProps {
  messages: Message[];
  isSending: boolean;
  isGeneratingAudio: boolean;
  showChat: boolean;
  notice: Notice | null;
  initError: string | null;
  sendError: string | null;
  onRetry: () => void;
  onResend: (text: string) => void;
  lastSendText: string;
  userName?: string;
  aiName?: string;
}

const MAX_RENDER_MESSAGES = 80;

export default function ChatArea({
  messages,
  isSending,
  isGeneratingAudio,
  showChat,
  notice,
  initError,
  sendError,
  onRetry,
  onResend,
  lastSendText,
  userName = 'わたし',
  aiName = 'ジョージ',
}: ChatAreaProps) {
  const prefersReducedMotion = useReducedMotion();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const visibleMessages = messages.length > MAX_RENDER_MESSAGES
    ? messages.slice(-MAX_RENDER_MESSAGES)
    : messages;
  const isMessagesTrimmed = messages.length > MAX_RENDER_MESSAGES;

  return (
    <>
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

              {/* Notice */}
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

              {/* Init Error */}
              {initError && (
                <div className="flex justify-center">
                  <div className="px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-white/80 text-sm flex items-center gap-3">
                    <span>{initError}</span>
                    <button
                      onClick={onRetry}
                      className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs"
                    >
                      再試行
                    </button>
                  </div>
                </div>
              )}

              {/* Send Error */}
              {sendError && (
                <div className="flex justify-center">
                  <div className="px-4 py-3 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-100 text-sm flex items-center gap-3">
                    <span>{sendError}</span>
                    <button
                      onClick={() => onResend(lastSendText)}
                      className="px-3 py-1 rounded-full bg-red-500/40 hover:bg-red-500/60 text-xs"
                    >
                      再送
                    </button>
                  </div>
                </div>
              )}

              {/* Messages */}
              {visibleMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'tarot' && msg.card ? (
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

              {/* Sending indicator */}
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

      {/* Non-chat mode: Show last message */}
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
    </>
  );
}
