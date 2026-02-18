'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface Notice {
  type: 'info' | 'success' | 'error';
  message: string;
}

interface UseNoticeOptions {
  defaultTtlMs?: number;
}

interface UseNoticeReturn {
  notice: Notice | null;
  pushNotice: (type: Notice['type'], message: string, ttlMs?: number) => void;
  clearNotice: () => void;
}

export function useNotice(options: UseNoticeOptions = {}): UseNoticeReturn {
  const { defaultTtlMs = 4000 } = options;

  const [notice, setNotice] = useState<Notice | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearNotice = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setNotice(null);
  }, []);

  const pushNotice = useCallback((type: Notice['type'], message: string, ttlMs?: number) => {
    setNotice({ type, message });

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      setNotice(null);
      timerRef.current = null;
    }, ttlMs ?? defaultTtlMs);
  }, [defaultTtlMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    notice,
    pushNotice,
    clearNotice,
  };
}
