'use client';

import { useState, useRef, useCallback } from 'react';
import { DrawnCard } from '@/lib/tarot/cards';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tarot';
  content: string;
  timestamp: Date;
  card?: DrawnCard;
}

interface UseChatOptions {
  userId: string;
  onLog?: (msg: string) => void;
  onError?: (error: string) => void;
  onBootstrapUpdate?: (data: { identity?: unknown; user?: unknown; isBootstrapped?: boolean }) => void;
  onResponse?: (message: string) => void;
}

interface UseChatReturn {
  messages: Message[];
  isSending: boolean;
  sendError: string | null;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  sendMessage: (text: string, showInChat?: boolean) => Promise<void>;
  loadHistory: () => Promise<boolean>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  lastSendTextRef: React.MutableRefObject<string>;
}

export function useChat(options: UseChatOptions): UseChatReturn {
  const { userId, onLog, onError, onBootstrapUpdate, onResponse } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSendTextRef = useRef<string>('');

  const log = useCallback((msg: string) => {
    onLog?.(msg);
  }, [onLog]);

  const loadHistory = useCallback(async () => {
    try {
      log('履歴を読み込み中...');
      const response = await fetch(`/api/chat?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        if (data?.history && data.history.length > 0) {
          log(`履歴復元: ${data.history.length}件`);
          const restoredMessages: Message[] = data.history.map((m: { role: string; content: string; timestamp?: string }, i: number) => ({
            id: `restored-${i}-${Date.now()}`,
            role: m.role as Message['role'],
            content: m.content,
            timestamp: new Date(m.timestamp || Date.now()),
          }));
          setMessages(restoredMessages);
          return true;
        }
      }
      return false;
    } catch (error) {
      log('履歴読み込みエラー: ' + (error as Error).message);
      return false;
    }
  }, [userId, log]);

  const sendMessage = useCallback(async (text: string, showInChat: boolean = true) => {
    if (!text.trim()) return;

    log(`メッセージ送信開始: ${text.substring(0, 10)}...`);
    setSendError(null);
    lastSendTextRef.current = text;

    // Abort existing request
    if (abortControllerRef.current) {
      log('以前のリクエストを中断');
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsSending(true);

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
            role: m.role === 'tarot' ? 'user' : m.role,
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

        if (data.identity || data.user) {
          onBootstrapUpdate?.({
            identity: data.identity,
            user: data.user,
            isBootstrapped: data.isBootstrapped,
          });
        }

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        // Call onResponse callback for TTS
        if (data.message) {
          onResponse?.(data.message);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        log('APIエラー: ' + (errorData.error || response.status));
        setSendError('送信に失敗しました。ネットワークを確認して再送してください。');
        onError?.(errorData.error || '送信エラー');
      }
    } catch (error: unknown) {
      if ((error as Error).name === 'AbortError') {
        log('リクエスト中断');
      } else {
        log('送信エラー: ' + (error as Error).message);
        setSendError('送信に失敗しました。ネットワークを確認して再送してください。');
        onError?.((error as Error).message);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsSending(false);
        abortControllerRef.current = null;
      }
    }
  }, [messages, userId, log, onBootstrapUpdate, onError]);

  return {
    messages,
    isSending,
    sendError,
    setMessages,
    sendMessage,
    loadHistory,
    abortControllerRef,
    lastSendTextRef,
  };
}
