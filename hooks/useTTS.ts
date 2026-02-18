'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { DEFAULT_VOICE_ID, getVoiceById } from '@/lib/tts/voices';

interface UseTTSOptions {
  voiceId?: string;
  onLog?: (msg: string) => void;
  onNotice?: (type: 'info' | 'success' | 'error', message: string) => void;
}

interface UseTTSReturn {
  isSpeaking: boolean;
  isGeneratingAudio: boolean;
  ttsEnabled: boolean;
  setTtsEnabled: (enabled: boolean) => void;
  playTTS: (text: string) => Promise<boolean>;
  stopTTS: () => void;
  unlockAudio: () => Promise<boolean>;
  audioUnlocked: boolean;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

export function useTTS(options: UseTTSOptions = {}): UseTTSReturn {
  const { voiceId, onLog, onNotice } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const ttsVersionRef = useRef<number>(0);
  const suppressAudioErrorRef = useRef<boolean>(false);

  const log = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    onLog?.(`[${timestamp}] ${msg}`);
  }, [onLog]);

  const pushNotice = useCallback((type: 'info' | 'success' | 'error', message: string) => {
    onNotice?.(type, message);
  }, [onNotice]);

  const speakWithBrowser = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      return false;
    }
  }, []);

  const stopDeepgramTTS = useCallback(() => {
    // No-op: streaming WS playback was removed for stability.
  }, []);

  const unlockAudio = useCallback(async (): Promise<boolean> => {
    try {
      if (audioUnlocked) return true;
      if (typeof window === 'undefined') return false;

      const unlockSrc = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';

      const targetAudio = audioRef.current;
      if (targetAudio && !isSpeaking && !isGeneratingAudio) {
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
        targetAudio.removeAttribute('src');
        targetAudio.load();
        window.setTimeout(() => {
          suppressAudioErrorRef.current = false;
        }, 180);
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
      console.warn('[audio] unlock failed', e);
      return false;
    }
  }, [audioUnlocked, isGeneratingAudio, isSpeaking, log]);

  const playDeepgramTTS = useCallback(async (text: string, version: number, voiceIdOverride?: string): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    stopDeepgramTTS();

    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voiceId: voiceIdOverride || voiceId || DEFAULT_VOICE_ID,
      }),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      throw new Error(`TTS API error: ${response.status} ${details}`);
    }

    if (version !== ttsVersionRef.current) return false;
    if (!audioRef.current) throw new Error('audio element missing');

    const audioBlob = await response.blob();
    if (version !== ttsVersionRef.current) return false;
    log(`TTS blob: ${audioBlob.size} bytes`);

    const nextUrl = URL.createObjectURL(audioBlob);
    const audio = audioRef.current;
    if (audio.src && audio.src.startsWith('blob:')) {
      URL.revokeObjectURL(audio.src);
    }

    // AudioContext for volume boosting
    if (!audioContextRef.current && typeof window !== 'undefined') {
      try {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          audioContextRef.current = ctx;
          const source = ctx.createMediaElementSource(audio);
          const gain = ctx.createGain();
          gain.gain.value = 2.0;
          gainNodeRef.current = gain;
          source.connect(gain);
          gain.connect(ctx.destination);
          log('オーディオ・ブースター有効化 (Gain: 2.0)');
        }
      } catch (e) {
        console.warn('AudioContext setup failed:', e);
      }
    }

    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      void audioContextRef.current.resume();
    }

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
      await audio.play();
      await new Promise(resolve => window.setTimeout(resolve, 600));
      if (version !== ttsVersionRef.current) return false;

      const stuck = audio.paused || audio.currentTime <= 0;
      if (stuck) {
        log(`TTS stuck detected`);
        const unlocked = await unlockAudio();
        if (version !== ttsVersionRef.current) return false;
        if (unlocked) {
          if (audio.src !== nextUrl) audio.src = nextUrl;
          audio.currentTime = 0;
          audio.muted = false;
          audio.volume = 1;
          audio.playbackRate = 1;
          await audio.play();
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const lowered = message.toLowerCase();
      if (lowered.includes('notallowed') || lowered.includes('gesture') || lowered.includes('interact')) {
        const unlocked = await unlockAudio();
        if (unlocked) {
          if (audio.src !== nextUrl) audio.src = nextUrl;
          audio.currentTime = 0;
          audio.muted = false;
          audio.volume = 1;
          audio.playbackRate = 1;
          await audio.play();
        } else {
          throw new Error(`play blocked: ${message}`);
        }
      } else {
        throw error;
      }
    }
    return true;
  }, [voiceId, stopDeepgramTTS, unlockAudio, log]);

  const playTTS = useCallback(async (text: string): Promise<boolean> => {
    if (!ttsEnabled) {
      log('TTS無効');
      return false;
    }

    log('音声生成開始...');
    setIsGeneratingAudio(true);
    const currentVersion = ++ttsVersionRef.current;
    const selectedVoiceId = voiceId && getVoiceById(voiceId) ? voiceId : DEFAULT_VOICE_ID;

    try {
      const ok = await playDeepgramTTS(text, currentVersion, selectedVoiceId);
      if (ok) return true;
      setIsGeneratingAudio(false);
      return false;
    } catch (error) {
      const message = (error as Error).message || 'unknown';
      log('音声再生失敗: ' + message);

      const lower = message.toLowerCase();
      const isPlaybackBlocked =
        lower.includes('notallowed') ||
        lower.includes('gesture') ||
        lower.includes('play blocked');

      if (isPlaybackBlocked) {
        pushNotice('error', '音声再生を開始できませんでした。画面を一度タップしてから再試行してください。');
      }

      setIsGeneratingAudio(false);
      const fallbackOk = speakWithBrowser(text);
      if (!fallbackOk) {
        setIsSpeaking(false);
      }
      return fallbackOk;
    }
  }, [ttsEnabled, log, playDeepgramTTS, speakWithBrowser, voiceId, pushNotice]);

  const stopTTS = useCallback(() => {
    const speechSynthesisActive = typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      (window.speechSynthesis.speaking || window.speechSynthesis.pending);

    const hasActivePlayback = isSpeaking || isGeneratingAudio || speechSynthesisActive;
    if (hasActivePlayback) {
      log('音声停止');
    }

    ttsVersionRef.current++;
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
      audio.removeAttribute('src');
      audio.load();
      window.setTimeout(() => {
        suppressAudioErrorRef.current = false;
      }, 250);
    }

    setIsSpeaking(false);
    setIsGeneratingAudio(false);
  }, [isGeneratingAudio, isSpeaking, log, stopDeepgramTTS]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTTS();
    };
  }, [stopTTS]);

  return {
    isSpeaking,
    isGeneratingAudio,
    ttsEnabled,
    setTtsEnabled,
    playTTS,
    stopTTS,
    unlockAudio,
    audioUnlocked,
    audioRef,
  };
}
