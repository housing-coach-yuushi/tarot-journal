import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Radio, Plus, Trash2, Clock, ChevronRight, ArrowLeft, Share2, SkipForward, SkipBack, Disc3, Mic2, Signal, Volume2 } from 'lucide-react';
import GlowVisualizer from './GlowVisualizer';

// Types
interface RadioLine {
    speaker: string;
    text: string;
}

interface RadioSession {
    id: string;
    title: string;
    subtitle: string;
    dateRange: string;
    audioUrl: string;
    coverImageUrl?: string;
    script: RadioLine[];
    isNew: boolean;
    createdAt: number;
    audioUpdatedAt?: number;
}

interface GeorgeRadioProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    userName: string;
    onGenerationComplete?: (title: string) => void;
}

// Constants
const RADIO_CONSTANTS = {
    FREQUENCY: '88.1 MHz',
    CHANNEL_NAME: "GEORGE'S CHANNEL",
    DEFAULT_SUBTITLE: 'Weekly Focus Session',
    STORAGE_KEY: 'george-radio-sessions',
};

// Storage utilities
const loadSessions = (): RadioSession[] => {
    if (typeof window === 'undefined') return [];
    try {
        const data = localStorage.getItem(RADIO_CONSTANTS.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

const saveSessions = (sessions: RadioSession[]) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(RADIO_CONSTANTS.STORAGE_KEY, JSON.stringify(sessions));
};

export default function GeorgeRadio({ isOpen, onClose, userId, userName, onGenerationComplete }: GeorgeRadioProps) {
    // State
    const [viewMode, setViewMode] = useState<'list' | 'player' | 'confirm' | 'loading'>('list');
    const [sessions, setSessions] = useState<RadioSession[]>([]);
    const [currentSession, setCurrentSession] = useState<RadioSession | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentLineIndex, setCurrentLineIndex] = useState(0);
    const [audioLevel, setAudioLevel] = useState(0);
    const [progress, setProgress] = useState(0);
    const [isAudioReady, setIsAudioReady] = useState(false);
    const [currentTimeSec, setCurrentTimeSec] = useState(0);
    const [durationSec, setDurationSec] = useState(0);
    const [isRefreshingAudio, setIsRefreshingAudio] = useState(false);
    const [audioStatusMessage, setAudioStatusMessage] = useState<string | null>(null);

    // Refs
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const analyzerRef = useRef<AnalyserNode | null>(null);
    const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const audioRefreshAttemptedRef = useRef<string | null>(null);

    const eqBars = [0.35, 0.6, 0.45, 0.8, 0.5, 0.65, 0.42, 0.72];
    const defaultCoverImageUrl = '/icon-options/george_illustrative.png';
    const activeCoverImageUrl = currentSession?.coverImageUrl || defaultCoverImageUrl;
    const hostVisuals = {
        George: '/icon-options/mystic_gold_mic_v2.png',
        Aria: '/icon-options/apple_voice_tarot.png',
    } as const;

    // Load sessions on mount
    useEffect(() => {
        if (isOpen) {
            const saved = loadSessions();
            setSessions(saved);
            setViewMode('list');
        }
    }, [isOpen]);

    // Reset modal state when it closes
    useEffect(() => {
        if (!isOpen) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            setIsPlaying(false);
            setCurrentSession(null);
            setViewMode('list');
        }
    }, [isOpen]);

    // Simple reactive level without WebAudio routing
    useEffect(() => {
        if (!isPlaying) {
            setAudioLevel(0);
            return;
        }
        const timer = window.setInterval(() => {
            setAudioLevel(prev => {
                const next = prev * 0.7 + Math.random() * 0.35;
                return Math.max(0.08, Math.min(next, 0.7));
            });
        }, 120);
        return () => {
            window.clearInterval(timer);
            setAudioLevel(0);
        };
    }, [isPlaying]);

    // Track audio progress
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !currentSession) return;

        const handleTimeUpdate = () => {
            const now = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
            setCurrentTimeSec(now);

            if (audio.duration && isFinite(audio.duration)) {
                setDurationSec(audio.duration);
                const pct = now / audio.duration;
                setProgress(pct);

                if (currentSession.script.length > 0) {
                    const idx = Math.min(
                        Math.floor(pct * currentSession.script.length),
                        currentSession.script.length - 1
                    );
                    setCurrentLineIndex(idx);
                }
            } else {
                setProgress(0);
            }
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
    }, [currentSession]);

    // --- Actions ---

    const generateRadio = async (forceRegenerate: boolean = false) => {
        setViewMode('loading');
        setError(null);

        try {
            const response = await fetch('/api/journal/radio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, userName, force: forceRegenerate }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                if (response.status === 404) {
                    throw new Error('まだ週次ラジオを作れる日記がありません。先にチェックインを1件以上保存してください。');
                }
                throw new Error(data.error || 'ラジオの生成に失敗しました。');
            }

            const data = await response.json();
            
            let dateRange = '';
            if (data.startDate && data.endDate) {
                const start = new Date(data.startDate);
                const end = new Date(data.endDate);
                const format = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
                dateRange = `${format(start)} - ${format(end)}`;
            }

            const newSession: RadioSession = {
                id: Date.now().toString(),
                title: data.title,
                subtitle: data.subtitle || RADIO_CONSTANTS.DEFAULT_SUBTITLE,
                dateRange,
                audioUrl: data.audioUrl,
                coverImageUrl: data.coverImageUrl || defaultCoverImageUrl,
                script: data.script,
                isNew: data.isNew,
                createdAt: Date.now(),
            };

            // Save to sessions
            const updatedSessions = [newSession, ...sessions];
            setSessions(updatedSessions);
            saveSessions(updatedSessions);

            // Play new session
            setCurrentSession(newSession);
            setViewMode('player');
            setIsAudioReady(false);

            if (onGenerationComplete) {
                onGenerationComplete(data.title);
            }
        } catch (err: any) {
            setError(err.message);
            setViewMode('confirm');
        }
    };

    const selectSession = (session: RadioSession) => {
        setCurrentSession(session);
        setViewMode('player');
        setProgress(0);
        setCurrentLineIndex(0);
        setIsAudioReady(false);
        setIsPlaying(false);
        setError(null);
        setAudioStatusMessage(null);
    };

    // Auto-load audio when session changes
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !currentSession?.audioUrl) return;

        // Reset state
        audio.pause();
        audio.currentTime = 0;
        audio.src = currentSession.audioUrl;
        audio.load();

        // Try to play after a short delay
        const playTimer = setTimeout(async () => {
            try {
                audio.muted = false;
                audio.volume = 1;
                await audio.play();
            } catch (err) {
                console.warn('Auto-play failed, user interaction required:', err);
            }
        }, 300);

        return () => clearTimeout(playTimer);
    }, [currentSession?.id, currentSession?.audioUrl]);

    useEffect(() => {
        audioRefreshAttemptedRef.current = null;
        setAudioStatusMessage(null);
    }, [currentSession?.id]);

    const deleteSession = (sessionId: string) => {
        const updated = sessions.filter(s => s.id !== sessionId);
        setSessions(updated);
        saveSessions(updated);
    };

    const updateSessionAudioUrl = useCallback((sessionId: string, audioUrl: string) => {
        const updatedAt = Date.now();
        setSessions(prev => {
            const next = prev.map(session =>
                session.id === sessionId ? { ...session, audioUrl, audioUpdatedAt: updatedAt } : session
            );
            saveSessions(next);
            return next;
        });

        setCurrentSession(prev =>
            prev && prev.id === sessionId ? { ...prev, audioUrl, audioUpdatedAt: updatedAt } : prev
        );
    }, []);

    const refreshSessionAudio = useCallback(async (session: RadioSession) => {
        if (!session.script?.length) {
            throw new Error('ラジオ台本が見つからないため音声を更新できません。');
        }

        setIsRefreshingAudio(true);
        setAudioStatusMessage('音声リンクを更新中...');
        setError(null);

        try {
            const response = await fetch('/api/journal/radio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    userName,
                    refreshAudioOnly: true,
                    script: session.script,
                }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data?.audioUrl) {
                throw new Error(data?.error || '音声リンクの更新に失敗しました。');
            }

            updateSessionAudioUrl(session.id, data.audioUrl);
            setAudioStatusMessage('音声リンクを更新しました。');
            return data.audioUrl as string;
        } finally {
            setIsRefreshingAudio(false);
        }
    }, [updateSessionAudioUrl, userId, userName]);

    const togglePlay = async () => {
        if (!audioRef.current || !currentSession?.audioUrl) {
            setError('音声データがありません。先に番組を生成してください。');
            return;
        }

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            setError(null);
            try {
                await audioRef.current.play();
            } catch (err: any) {
                const msg = err?.message || '音声再生に失敗しました';
                setError(`再生エラー: ${msg}`);
            }
        }
    };

    const handleRefreshCurrentAudio = useCallback(async (autoPlay: boolean = false) => {
        if (!currentSession) return;

        try {
            const nextUrl = await refreshSessionAudio(currentSession);
            const audio = audioRef.current;
            if (!audio) return;

            audio.pause();
            audio.currentTime = 0;
            audio.src = nextUrl;
            audio.load();

            if (autoPlay) {
                setTimeout(async () => {
                    try {
                        await audio.play();
                    } catch (err) {
                        console.warn('Auto-play after audio refresh failed:', err);
                    }
                }, 250);
            }
        } catch (err: any) {
            setAudioStatusMessage(null);
            setError(err?.message || '音声リンクの更新に失敗しました。');
        }
    }, [currentSession, refreshSessionAudio]);

    const playFromStart = async () => {
        const audio = audioRef.current;
        if (!audio || !currentSession?.audioUrl) return;
        audio.currentTime = 0;
        setError(null);
        try {
            await audio.play();
        } catch (err: any) {
            const msg = err?.message || '音声再生に失敗しました';
            setError(`再生エラー: ${msg}`);
        }
    };

    const seekBy = (deltaSec: number) => {
        const audio = audioRef.current;
        if (!audio) return;
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
        const next = Math.max(0, audio.currentTime + deltaSec);
        audio.currentTime = duration > 0 ? Math.min(duration, next) : next;
    };

    const handleShareSession = async () => {
        if (!currentSession || currentSession.script.length === 0) {
            alert('共有する内容がありません');
            return;
        }

        try {
            const messages = currentSession.script.map(line => ({
                role: line.speaker.toLowerCase() === 'george' ? 'assistant' : 'user',
                content: `[${line.speaker}] ${line.text}`,
            }));

            const response = await fetch('/api/journal/format-share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, messages }),
            });

            let shareTitle = currentSession.title || '今日のラジオ';
            let shareText = '';

            if (response.ok) {
                const data = await response.json();
                shareTitle = data.title || shareTitle;
                shareText = data.text || '';
            } else {
                shareText = currentSession.script.map(line => `${line.speaker}: ${line.text}`).join('\n\n');
            }

            if (navigator.share) {
                try {
                    await navigator.share({ title: shareTitle, text: shareText });
                } catch (error) {
                    if ((error as Error).name !== 'AbortError') {
                        console.error('共有エラー:', error);
                    }
                }
            } else {
                try {
                    await navigator.clipboard.writeText(shareText);
                    alert('クリップボードにコピーしました！');
                } catch (err) {
                    console.error('コピー失敗:', err);
                }
            }
        } catch (error) {
            console.error('共有準備エラー:', error);
        }
    };

    const formatTime = (totalSec: number) => {
        if (!Number.isFinite(totalSec) || totalSec < 0) return '0:00';
        const seconds = Math.floor(totalSec);
        const minutes = Math.floor(seconds / 60);
        const remain = seconds % 60;
        return `${minutes}:${String(remain).padStart(2, '0')}`;
    };

    const activeLine = currentSession?.script[currentLineIndex];

    // Reset source node when session changes
    useEffect(() => {
        sourceNodeRef.current = null;
        setIsAudioReady(false);
        setProgress(0);
        setCurrentTimeSec(0);
        setDurationSec(0);
    }, [currentSession?.id]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex flex-col p-4 sm:p-6 text-white safe-area-inset overflow-hidden bg-[#02060d]"
                >
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background:
                                'radial-gradient(circle at 15% 20%, rgba(35, 166, 213, 0.22), transparent 38%), radial-gradient(circle at 85% 15%, rgba(99, 102, 241, 0.2), transparent 40%), radial-gradient(circle at 50% 100%, rgba(34, 211, 238, 0.15), transparent 48%)',
                        }}
                    />
                    <div className="absolute inset-0 pointer-events-none star-grid opacity-30" />
                    <div
                        className="absolute inset-0 pointer-events-none opacity-25"
                        style={{
                            backgroundImage: `url(${activeCoverImageUrl})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            filter: 'blur(6px) saturate(110%)',
                        }}
                    />

                    {/* Background Aurora Effect */}
                    <div className="absolute inset-x-0 bottom-0 h-3/4 pointer-events-none opacity-60">
                        <GlowVisualizer isActive={isPlaying} audioLevel={audioLevel} />
                    </div>

                    {/* Header */}
                    <div className="relative z-10 flex items-center justify-between mb-6 px-3 py-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
                        <button
                            onClick={viewMode === 'player' ? () => setViewMode('list') : onClose}
                            className="p-2.5 rounded-full bg-white/5 hover:bg-white/15 transition-colors border border-white/10"
                        >
                            <ArrowLeft size={20} />
                        </button>

                        <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-2">
                                <motion.div
                                    animate={isPlaying && viewMode === 'player' ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
                                    transition={{ repeat: Infinity, duration: 1.5 }}
                                    className={`w-2 h-2 rounded-full ${isPlaying && viewMode === 'player' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-white/20'}`}
                                />
                                <span className={`text-[10px] font-bold tracking-[0.32em] uppercase mr-[-0.32em] ${isPlaying && viewMode === 'player' ? 'text-cyan-100' : 'text-white/35'}`}>
                                    {isPlaying && viewMode === 'player' ? 'ON AIR' : 'OFF AIR'}
                                </span>
                            </div>
                            <span className="text-[8px] font-medium tracking-[0.2em] text-white/30">88.1 MHz | GEORGE'S CHANNEL</span>
                        </div>

                        <button
                            onClick={viewMode === 'player' ? handleShareSession : () => setViewMode('confirm')}
                            className="p-2.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 transition-colors border border-cyan-400/30"
                        >
                            {viewMode === 'player' ? <Share2 size={20} /> : <Plus size={20} />}
                        </button>
                    </div>

                    {/* Main Content */}
                    <div className="relative z-10 flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
                        {viewMode === 'list' && (
                            <ListUI
                                sessions={sessions}
                                onSelect={selectSession}
                                onDelete={deleteSession}
                                onNew={() => setViewMode('confirm')}
                            />
                        )}
                        {viewMode === 'confirm' && (
                            <ConfirmUI
                                onGenerate={() => generateRadio(false)}
                                onForceGenerate={() => generateRadio(true)}
                                onCancel={() => setViewMode('list')}
                                error={error}
                            />
                        )}
                        {viewMode === 'loading' && (
                            <LoadingUI progress={50} stage="analyzing" onClose={onClose} />
                        )}
                        {viewMode === 'player' && currentSession && (
                            <div className="w-full space-y-3">
                                {(error || audioStatusMessage) && (
                                    <div className={`w-full max-w-5xl mx-auto rounded-2xl border px-4 py-3 text-sm flex items-center justify-between gap-3 ${
                                        error
                                            ? 'bg-red-500/10 border-red-300/30 text-red-100'
                                            : 'bg-cyan-300/10 border-cyan-200/25 text-cyan-100'
                                    }`}>
                                        <span className="leading-snug">{error || audioStatusMessage}</span>
                                        <button
                                            onClick={() => handleRefreshCurrentAudio(true)}
                                            disabled={isRefreshingAudio}
                                            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                                                isRefreshingAudio
                                                    ? 'border-white/10 text-white/40'
                                                    : 'border-white/20 text-white/90 hover:bg-white/10'
                                            }`}
                                        >
                                            {isRefreshingAudio ? '更新中...' : '音声を更新'}
                                        </button>
                                    </div>
                                )}
                                <PlayerUI
                                    session={currentSession}
                                    currentLineIndex={currentLineIndex}
                                    isPlaying={isPlaying}
                                    progress={progress}
                                    isAudioReady={isAudioReady}
                                    currentTimeSec={currentTimeSec}
                                    durationSec={durationSec}
                                    audioLevel={audioLevel}
                                    activeLine={activeLine}
                                    eqBars={eqBars}
                                    hostVisuals={hostVisuals}
                                    coverImageUrl={activeCoverImageUrl}
                                    isRefreshingAudio={isRefreshingAudio}
                                    onTogglePlay={togglePlay}
                                    onPlayFromStart={playFromStart}
                                    onSeek={seekBy}
                                    onRefreshAudio={() => handleRefreshCurrentAudio(false)}
                                />
                            </div>
                        )}
                    </div>

                    <audio
                        ref={audioRef}
                        src={currentSession?.audioUrl || undefined}
                        preload="auto"
                        playsInline
                        crossOrigin="anonymous"
                        onLoadStart={() => {
                            setIsAudioReady(false);
                            setCurrentTimeSec(0);
                            if (!isRefreshingAudio) setAudioStatusMessage('音声を読み込み中...');
                        }}
                        onCanPlay={() => {
                            setIsAudioReady(true);
                            setAudioStatusMessage(null);
                        }}
                        onLoadedMetadata={() => {
                            const audio = audioRef.current;
                            if (!audio) return;
                            if (Number.isFinite(audio.duration)) {
                                setDurationSec(audio.duration);
                            }
                            setIsAudioReady(true);
                            setAudioStatusMessage(null);
                        }}
                        onLoadedData={() => {
                            setIsAudioReady(true);
                            setAudioStatusMessage(null);
                        }}
                        onEnded={() => {
                            setIsPlaying(false);
                            setCurrentTimeSec(durationSec);
                        }}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onError={() => {
                            setIsPlaying(false);
                            if (currentSession && audioRefreshAttemptedRef.current !== currentSession.id) {
                                audioRefreshAttemptedRef.current = currentSession.id;
                                void handleRefreshCurrentAudio(true);
                                return;
                            }
                            setAudioStatusMessage(null);
                            setError('音声の読み込みに失敗しました。音声を更新してください。');
                        }}
                    />

                    <style jsx>{`
                        .mask-fade-y {
                            mask-image: linear-gradient(to bottom, transparent, black 15%, black 85%, transparent);
                            -webkit-mask-image: linear-gradient(to bottom, transparent, black 15%, black 85%, transparent);
                        }
                        .scrollbar-hide::-webkit-scrollbar { display: none; }
                        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
                        @keyframes scan { 0% { opacity: 0.3; } 50% { opacity: 1; } 100% { opacity: 0.3; } }
                        .scanning-text { animation: scan 1.5s infinite ease-in-out; }
                        .star-grid {
                            background-image:
                                radial-gradient(circle at 1px 1px, rgba(255,255,255,0.12) 1px, transparent 0);
                            background-size: 26px 26px;
                        }
                    `}</style>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// --- Sub Components ---

function ListUI({ 
    sessions, 
    onSelect, 
    onDelete, 
    onNew 
}: { 
    sessions: RadioSession[]; 
    onSelect: (session: RadioSession) => void;
    onDelete: (id: string) => void;
    onNew: () => void;
}) {
    const formatDate = (timestamp: number) => {
        const d = new Date(timestamp);
        return `${d.getMonth() + 1}/${d.getDate()}`;
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full flex-1 flex flex-col"
        >
            <div className="text-center mb-8">
                <h2 className="text-2xl font-light tracking-tight mb-2">George's Radio</h2>
                <p className="text-white/40 text-xs">Weekly Focus Sessions</p>
            </div>

            {sessions.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-6">
                    <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                        <Radio className="text-white/30" size={32} />
                    </div>
                    <div className="text-center space-y-2">
                        <p className="text-white/60 text-sm">まだ番組がありません</p>
                        <p className="text-white/30 text-xs">最初の番組を作成してみましょう</p>
                    </div>
                    <button
                        onClick={onNew}
                        className="px-6 py-3 rounded-full bg-white/10 border border-white/20 text-sm hover:bg-white/20 transition-colors"
                    >
                        番組を作成
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {sessions.map((session) => (
                        <motion.div
                            key={session.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                        >
                            <div className="flex items-start justify-between">
                                <button
                                    onClick={() => onSelect(session)}
                                    className="flex-1 text-left"
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        {session.isNew && (
                                            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-medium">
                                                NEW
                                            </span>
                                        )}
                                        <span className="text-white/40 text-xs">{formatDate(session.createdAt)}</span>
                                    </div>
                                    <h3 className="text-white font-medium mb-1">{session.title}</h3>
                                    <p className="text-white/40 text-xs">{session.subtitle}</p>
                                </button>
                                <button
                                    onClick={() => onDelete(session.id)}
                                    className="p-2 rounded-full hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                    <button
                        onClick={onNew}
                        className="w-full p-4 rounded-2xl border border-dashed border-white/20 text-white/40 hover:bg-white/5 hover:text-white/60 transition-colors flex items-center justify-center gap-2"
                    >
                        <Plus size={18} />
                        <span className="text-sm">新しい番組</span>
                    </button>
                </div>
            )}
        </motion.div>
    );
}

function ConfirmUI({
    onGenerate,
    onForceGenerate,
    onCancel,
    error,
}: {
    onGenerate: () => void;
    onForceGenerate: () => void;
    onCancel: () => void;
    error: string | null;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-8 p-8 bg-white/5 rounded-[2.5rem] border border-white/10 backdrop-blur-2xl shadow-[0_22px_60px_rgba(0,0,0,0.55)] max-w-md"
        >
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-cyan-300/30 bg-cyan-400/10 shadow-[0_0_40px_rgba(34,211,238,0.25)]">
                <Radio className="text-cyan-200" size={32} />
            </div>
            <div className="space-y-4">
                <h2 className="text-2xl font-light tracking-tight">Weekly George's Radio</h2>
                <p className="text-white/60 text-sm leading-relaxed">
                    １週間を振り返る番組を生成しますか？
                </p>
                <div className="p-4 bg-white/5 rounded-2xl text-left space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                        <p className="text-[11px] text-white/40 leading-normal">
                            生成には30秒〜1分ほどかかる場合があります。
                        </p>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5 shrink-0" />
                        <p className="text-[11px] text-white/50 leading-normal">
                            <span className="text-yellow-200 font-medium">最低3日分</span>のジャーナルが必要です。まだ日記が足りない場合は、もう数日間記録をつけてからお試しください。
                        </p>
                    </div>
                </div>
            </div>
            {error && (
                <div className="p-4 bg-red-500/10 rounded-xl border border-red-400/30">
                    <p className="text-red-200 text-sm">{error}</p>
                </div>
            )}
            <div className="flex flex-col gap-3">
                <button
                    onClick={onGenerate}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-200 to-blue-200 text-[#021322] text-xs font-bold tracking-[0.2em] uppercase hover:brightness-110 transition-all shadow-[0_0_24px_rgba(125,211,252,0.5)]"
                >
                    番組を生成する
                </button>
                <button
                    onClick={onForceGenerate}
                    className="w-full py-4 rounded-2xl border border-cyan-300/35 bg-cyan-300/10 text-cyan-100 text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-cyan-300/20 transition-all"
                >
                    再生成する（キャッシュ無視）
                </button>
                <button
                    onClick={onCancel}
                    className="w-full py-4 rounded-2xl bg-transparent text-white/40 text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-white/5 transition-all"
                >
                    今はやめておく
                </button>
            </div>
        </motion.div>
    );
}

function LoadingUI({ progress = 50, stage = 'analyzing', onClose }: { progress?: number; stage?: 'analyzing' | 'generating' | 'synthesizing'; onClose?: () => void }) {
    const stageText = {
        analyzing: 'ジャーナルを分析中...',
        generating: 'スクリプトを生成中...',
        synthesizing: '音声を合成中...',
    };

    const stageIcon = {
        analyzing: '📊',
        generating: '✍️',
        synthesizing: '🎙️',
    };

    const handleClose = () => {
        if (onClose) {
            onClose();
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-6 p-8 bg-white/5 rounded-[2.5rem] border border-white/10 backdrop-blur-2xl shadow-[0_22px_60px_rgba(0,0,0,0.55)] max-w-md"
        >
            <div className="relative w-24 h-24 mx-auto">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="w-24 h-24 border-2 border-white/20 border-t-cyan-400 rounded-full"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl">{stageIcon[stage]}</span>
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-cyan-100">
                    <motion.div
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="w-2 h-2 rounded-full bg-cyan-400"
                    />
                    <p className="text-sm font-medium tracking-wide">{stageText[stage]}</p>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-cyan-400 to-blue-400"
                    />
                </div>

                <p className="text-white/40 text-xs">{progress}%</p>
            </div>

            <div className="p-4 bg-white/5 rounded-2xl text-left">
                <p className="text-[11px] text-white/40 leading-relaxed">
                    生成には3〜5分ほどかかる場合があります。この画面を閉じても、準備ができたら通知でお知らせします。
                </p>
            </div>

            <button
                onClick={handleClose}
                className="px-6 py-2 rounded-full border border-white/20 text-white/50 text-xs hover:bg-white/5 transition-colors"
            >
                バックグラウンドで続ける
            </button>
        </motion.div>
    );
}

function PlayerUI({
    session,
    currentLineIndex,
    isPlaying,
    progress,
    isAudioReady,
    currentTimeSec,
    durationSec,
    audioLevel,
    activeLine,
    eqBars,
    hostVisuals,
    coverImageUrl,
    isRefreshingAudio,
    onTogglePlay,
    onPlayFromStart,
    onSeek,
    onRefreshAudio,
}: {
    session: RadioSession;
    currentLineIndex: number;
    isPlaying: boolean;
    progress: number;
    isAudioReady: boolean;
    currentTimeSec: number;
    durationSec: number;
    audioLevel: number;
    activeLine: RadioLine | undefined;
    eqBars: number[];
    hostVisuals: { George: string; Aria: string };
    coverImageUrl: string;
    isRefreshingAudio: boolean;
    onTogglePlay: () => void;
    onPlayFromStart: () => void;
    onSeek: (deltaSec: number) => void;
    onRefreshAudio: () => void;
}) {
    const formatTime = (totalSec: number) => {
        if (!Number.isFinite(totalSec) || totalSec < 0) return '0:00';
        const seconds = Math.floor(totalSec);
        const minutes = Math.floor(seconds / 60);
        const remain = seconds % 60;
        return `${minutes}:${String(remain).padStart(2, '0')}`;
    };

    const downloadAudio = async () => {
        if (!session.audioUrl) return;

        const filename = `${(session.title || 'radio').replace(/[\\/:*?"<>|]/g, '_')}.mp3`;
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
        const isAndroid = /Android/i.test(ua);

        const openDirectUrl = () => {
            const a = document.createElement('a');
            a.href = session.audioUrl;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };

        try {
            const response = await fetch(session.audioUrl, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const blob = await response.blob();
            const audioBlob = blob.type ? blob : new Blob([blob], { type: 'audio/mpeg' });

            if (isAndroid && typeof File !== 'undefined' && navigator.share) {
                const file = new File([audioBlob], filename, { type: audioBlob.type || 'audio/mpeg' });
                const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
                const shareData: ShareData = { files: [file], title: session.title || 'George Radio' };
                if (!nav.canShare || nav.canShare(shareData)) {
                    try {
                        await navigator.share(shareData);
                        return;
                    } catch (shareError) {
                        if ((shareError as Error).name === 'AbortError') return;
                    }
                }
            }

            const url = URL.createObjectURL(audioBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            window.setTimeout(() => {
                URL.revokeObjectURL(url);
            }, isAndroid ? 60000 : 5000);
        } catch (err) {
            console.error('Radio audio download failed, fallback to direct URL:', err);
            openDirectUrl();
        }
    };

    return (
        <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full"
        >
            <div className="text-center mb-6 px-4">
                <div className="inline-flex items-center px-3 py-1.5 mb-4 rounded-full bg-white/5 border border-white/15 gap-2">
                    <span className={`text-[8px] font-bold tracking-widest uppercase ${session.isNew ? 'text-cyan-200' : 'text-white/45'}`}>
                        {session.isNew ? 'LIVE ARCHIVE READY' : 'RECORDED SESSION'}
                    </span>
                    {session.dateRange && (
                        <span className="text-[8px] font-bold tracking-widest uppercase text-white/25 border-l border-white/10 pl-2">
                            {session.dateRange}
                        </span>
                    )}
                </div>

                <h1 className="text-3xl sm:text-4xl font-light tracking-tight mb-2 text-white">
                    {session.title}
                </h1>
                <div className="flex items-center justify-center gap-3">
                    <div className="h-[1px] w-12 bg-cyan-300/25" />
                    <p className="text-[10px] tracking-[0.28em] uppercase text-cyan-100/70 font-medium">{session.subtitle}</p>
                    <div className="h-[1px] w-12 bg-cyan-300/25" />
                </div>
            </div>

            <div className="w-full max-w-5xl grid lg:grid-cols-[1.4fr_1fr] gap-4 sm:gap-6">
                {/* Script Section */}
                <section className="rounded-[2rem] border border-cyan-100/15 bg-[#060d18]/85 backdrop-blur-2xl shadow-[0_20px_55px_rgba(0,0,0,0.5)] overflow-hidden">
                    <div className="relative border-b border-white/10">
                        <img
                            src={coverImageUrl}
                            alt="Weekly Radio Cover"
                            className="w-full h-36 sm:h-48 object-cover opacity-85"
                            loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#050a14] via-[#050a14]/35 to-transparent" />
                        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                            <div className="px-2.5 py-1 rounded-full bg-black/55 border border-cyan-200/30 text-[9px] font-semibold tracking-[0.3em] text-cyan-100 uppercase">
                                88.1 MHz
                            </div>
                            <div className={`px-2.5 py-1 rounded-full border text-[9px] font-semibold tracking-[0.22em] uppercase ${isPlaying ? 'bg-red-500/20 border-red-300/60 text-red-100' : 'bg-white/10 border-white/20 text-white/60'}`}>
                                {isPlaying ? 'On Air' : 'Standby'}
                            </div>
                        </div>
                    </div>

                    <div className="px-4 sm:px-5 py-3 border-b border-white/10 bg-[#050b14]/90">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[9px] tracking-[0.32em] uppercase text-cyan-200/70 mb-1">
                                    Now Talking
                                </p>
                                <p className="text-sm sm:text-base font-medium text-white truncate">
                                    {activeLine ? `${activeLine.speaker}: ${activeLine.text}` : '配信の準備ができています。'}
                                </p>
                            </div>
                            <div className="hidden sm:flex items-center gap-2">
                                {(['George', 'Aria'] as const).map((name) => (
                                    <div key={name} className="relative w-11 h-11 rounded-full border border-cyan-100/30 overflow-hidden bg-black/50">
                                        <Disc3 size={22} className={`absolute inset-0 m-auto text-white/15 ${isPlaying ? 'animate-spin [animation-duration:7s]' : ''}`} />
                                        <img
                                            src={hostVisuals[name]}
                                            alt={`${name} visual`}
                                            className="w-full h-full object-cover opacity-90"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="h-56 overflow-y-auto mask-fade-y scrollbar-hide px-4 sm:px-5 py-4 bg-[#030810]/85">
                        <div className="space-y-4 pb-12">
                            {session.script.map((line, i) => {
                                const isActive = currentLineIndex === i;
                                const isGeorge = line.speaker.toLowerCase() === 'george';
                                return (
                                    <motion.div
                                        key={`${line.speaker}-${i}`}
                                        className={`flex ${isGeorge ? 'justify-start' : 'justify-end'} transition-all duration-500 ${isActive ? 'opacity-100' : 'opacity-45'}`}
                                    >
                                        <div className={`max-w-[92%] sm:max-w-[82%] rounded-2xl px-3.5 py-2.5 border ${
                                            isGeorge
                                                ? isActive
                                                    ? 'bg-cyan-400/14 border-cyan-200/35'
                                                    : 'bg-cyan-400/5 border-cyan-200/20'
                                                : isActive
                                                    ? 'bg-indigo-400/16 border-indigo-200/35'
                                                    : 'bg-indigo-400/6 border-indigo-200/20'
                                        }`}>
                                            <p className={`text-[9px] tracking-[0.28em] uppercase font-semibold mb-1 ${isActive ? 'text-cyan-100' : 'text-white/45'}`}>
                                                {line.speaker}
                                            </p>
                                            <p className={`text-sm sm:text-[15px] leading-relaxed ${isActive ? 'text-white' : 'text-white/65'}`}>
                                                {line.text}
                                            </p>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Controls Section */}
                <section className="rounded-[2rem] border border-cyan-100/20 bg-[#070d18]/90 backdrop-blur-2xl shadow-[0_20px_55px_rgba(0,0,0,0.55)] p-5 sm:p-6">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                            <p className="text-[9px] tracking-[0.25em] uppercase text-white/45 mb-1">Status</p>
                            <div className="flex items-center gap-1.5 text-cyan-100">
                                <Signal size={13} />
                                <span className="text-xs font-semibold">{isPlaying ? 'Broadcasting' : 'Standby'}</span>
                            </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                            <p className="text-[9px] tracking-[0.25em] uppercase text-white/45 mb-1">Level</p>
                            <div className="flex items-center gap-1.5 text-cyan-100">
                                <Volume2 size={13} />
                                <span className="text-xs font-semibold">{Math.round(audioLevel * 140)}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 mb-5">
                        <div className="relative w-full h-1.5 bg-white/15 rounded-full mb-2 overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-cyan-300 via-blue-300 to-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.45)] transition-all duration-300 ease-linear"
                                style={{ width: `${progress * 100}%` }}
                            />
                        </div>
                        <div className="flex items-center justify-between text-[10px] tracking-[0.18em] uppercase text-white/55 font-semibold">
                            <span>{formatTime(currentTimeSec)}</span>
                            <span>{durationSec > 0 ? formatTime(durationSec) : '--:--'}</span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-center gap-4 mb-5">
                        <button
                            onClick={() => onSeek(-15)}
                            className="w-12 h-12 rounded-full border border-white/15 bg-white/5 text-white/55 hover:text-cyan-100 hover:border-cyan-200/35 transition-colors flex items-center justify-center"
                            aria-label="15秒戻る"
                        >
                            <SkipBack size={20} />
                        </button>
                        <motion.button
                            whileTap={{ scale: 0.92 }}
                            onClick={onTogglePlay}
                            className="w-20 h-20 rounded-full bg-gradient-to-b from-cyan-100 to-cyan-300 text-[#02111d] flex items-center justify-center shadow-[0_14px_35px_rgba(34,211,238,0.4)] hover:scale-105 transition-all"
                        >
                            {isPlaying ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" className="ml-1" />}
                        </motion.button>
                        <button
                            onClick={() => onSeek(15)}
                            className="w-12 h-12 rounded-full border border-white/15 bg-white/5 text-white/55 hover:text-cyan-100 hover:border-cyan-200/35 transition-colors flex items-center justify-center"
                            aria-label="15秒進む"
                        >
                            <SkipForward size={20} />
                        </button>
                    </div>

                    {/* Equalizer */}
                    <div className="grid grid-cols-8 gap-1.5 items-end h-9 mb-5 rounded-xl border border-white/10 bg-black/25 px-2">
                        {eqBars.map((bar, i) => (
                            <motion.span
                                key={i}
                                className="rounded-full bg-gradient-to-t from-cyan-500/80 to-cyan-100/90"
                                animate={isPlaying ? { height: [`${10 + bar * 12}px`, `${16 + bar * 28}px`, `${8 + bar * 20}px`] } : { height: '8px', opacity: 0.45 }}
                                transition={{ duration: 0.9 + (i % 3) * 0.25, repeat: Infinity, ease: 'easeInOut' }}
                            />
                        ))}
                    </div>

                    <div className="flex flex-col gap-2 mb-4">
                        <button
                            onClick={onTogglePlay}
                            disabled={!session.audioUrl}
                            className={`w-full py-2.5 rounded-xl text-sm font-semibold tracking-wide border transition-colors ${
                                session.audioUrl
                                    ? 'border-cyan-300/40 bg-cyan-200/10 text-cyan-100 hover:bg-cyan-200/20'
                                    : 'border-white/10 bg-white/5 text-white/40 cursor-not-allowed'
                            }`}
                        >
                            {isPlaying ? '放送を停止' : (isAudioReady ? '放送を再生' : '読み込み中...')}
                        </button>
                        <button
                            onClick={onPlayFromStart}
                            disabled={!session.audioUrl}
                            className={`w-full py-2.5 rounded-xl text-sm font-semibold tracking-wide border transition-colors ${
                                session.audioUrl
                                    ? 'border-white/20 bg-white/10 text-white/90 hover:bg-white/20'
                                    : 'border-white/10 bg-white/5 text-white/40 cursor-not-allowed'
                            }`}
                        >
                            冒頭から再生
                        </button>
                        <button
                            onClick={onRefreshAudio}
                            disabled={isRefreshingAudio || !session.script?.length}
                            className={`w-full py-2.5 rounded-xl text-sm font-semibold tracking-wide border transition-colors ${
                                isRefreshingAudio || !session.script?.length
                                    ? 'border-white/10 bg-white/5 text-white/40 cursor-not-allowed'
                                    : 'border-cyan-200/25 bg-cyan-100/5 text-cyan-100 hover:bg-cyan-100/10'
                            }`}
                        >
                            {isRefreshingAudio ? '音声リンクを更新中...' : '音声を更新（再取得）'}
                        </button>
                        <button
                            onClick={downloadAudio}
                            disabled={!session.audioUrl}
                            className={`w-full py-2.5 rounded-xl text-sm font-semibold tracking-wide border transition-colors flex items-center justify-center gap-2 ${
                                session.audioUrl
                                    ? 'border-purple-300/40 bg-purple-200/10 text-purple-100 hover:bg-purple-200/20'
                                    : 'border-white/10 bg-white/5 text-white/40 cursor-not-allowed'
                            }`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                            音声をダウンロード
                        </button>
                    </div>

                    <div className="rounded-xl border border-cyan-200/20 bg-cyan-200/5 px-3 py-2.5">
                        <div className="flex items-center gap-2 text-cyan-100/85">
                            <Mic2 size={14} />
                            <p className="text-[10px] tracking-[0.18em] uppercase font-semibold">Radio Console</p>
                        </div>
                        <p className="text-[11px] text-white/60 mt-1.5 leading-relaxed">
                            音声が出ない場合は自動で復旧を試し、必要なら「音声を更新」でリンクを再取得します。
                        </p>
                    </div>
                </section>
            </div>
        </motion.div>
    );
}
