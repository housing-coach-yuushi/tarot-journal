import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Radio, Plus, Trash2, Clock, ChevronRight, ArrowLeft, Share2 } from 'lucide-react';
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
    script: RadioLine[];
    isNew: boolean;
    createdAt: number;
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

    // Refs
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const analyzerRef = useRef<AnalyserNode | null>(null);
    const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Load sessions on mount
    useEffect(() => {
        if (isOpen) {
            const saved = loadSessions();
            setSessions(saved);
            setViewMode('list');
        }
    }, [isOpen]);

    // --- Audio Logic ---

    const setupAudioAnalyser = useCallback(() => {
        if (!audioRef.current || !currentSession?.audioUrl) return;

        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const audioContext = audioContextRef.current;

        if (!sourceNodeRef.current) {
            try {
                const source = audioContext.createMediaElementSource(audioRef.current);
                sourceNodeRef.current = source;
                
                const analyzer = audioContext.createAnalyser();
                analyzer.fftSize = 256;
                source.connect(analyzer);
                analyzer.connect(audioContext.destination);
                analyzerRef.current = analyzer;
            } catch (e) {
                console.error("Error setting up audio source:", e);
                return;
            }
        }

        const updateLevel = () => {
            if (analyzerRef.current && isPlaying) {
                const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
                analyzerRef.current.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
                setAudioLevel(average / 150);
            } else {
                setAudioLevel(0);
            }
            animationFrameRef.current = requestAnimationFrame(updateLevel);
        };

        updateLevel();
    }, [currentSession?.audioUrl, isPlaying]);

    useEffect(() => {
        setupAudioAnalyser();
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [setupAudioAnalyser]);

    // Track audio progress
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !currentSession) return;

        const handleTimeUpdate = () => {
            if (audio.duration && isFinite(audio.duration)) {
                const pct = audio.currentTime / audio.duration;
                setProgress(pct);

                if (currentSession.script.length > 0) {
                    const idx = Math.min(
                        Math.floor(pct * currentSession.script.length),
                        currentSession.script.length - 1
                    );
                    setCurrentLineIndex(idx);
                }
            }
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
    }, [currentSession]);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setIsPlaying(false);
            if (audioRef.current) audioRef.current.pause();
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            setCurrentSession(null);
            setViewMode('list');
        }
    }, [isOpen]);

    // Reset source node when session changes
    useEffect(() => {
        sourceNodeRef.current = null;
    }, [currentSession?.id]);

    // --- Actions ---

    const generateRadio = async () => {
        setViewMode('loading');
        setError(null);

        try {
            const response = await fetch('/api/journal/radio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, userName }),
            });

            if (!response.ok) {
                const data = await response.json();
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
    };

    const deleteSession = (sessionId: string) => {
        const updated = sessions.filter(s => s.id !== sessionId);
        setSessions(updated);
        saveSessions(updated);
    };

    const togglePlay = async () => {
        if (!audioRef.current) return;

        if (audioContextRef.current?.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
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
                body: JSON.stringify({ messages }),
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

    // --- Render ---

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] bg-black flex flex-col p-6 text-white safe-area-inset overflow-hidden"
                >
                    <div className="absolute inset-x-0 bottom-0 h-3/4 pointer-events-none opacity-60">
                        <GlowVisualizer isActive={isPlaying} audioLevel={audioLevel} />
                    </div>

                    {/* Header */}
                    <header className="relative z-10 flex items-center justify-between mb-8">
                        {viewMode === 'player' ? (
                            <button
                                onClick={() => setViewMode('list')}
                                className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
                            >
                                <ArrowLeft size={20} />
                            </button>
                        ) : (
                            <button
                                onClick={onClose}
                                className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
                            >
                                <ArrowLeft size={20} />
                            </button>
                        )}

                        <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-2">
                                <motion.div
                                    animate={isPlaying && viewMode === 'player' ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
                                    transition={{ repeat: Infinity, duration: 1.5 }}
                                    className={`w-2 h-2 rounded-full ${isPlaying && viewMode === 'player' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-white/20'}`}
                                />
                                <span className={`text-[10px] font-bold tracking-[0.4em] uppercase mr-[-0.4em] ${isPlaying && viewMode === 'player' ? 'text-white' : 'text-white/30'}`}>
                                    {isPlaying && viewMode === 'player' ? 'ON AIR' : 'OFF AIR'}
                                </span>
                            </div>
                            <span className="text-[8px] font-medium tracking-[0.2em] text-white/20">
                                {RADIO_CONSTANTS.FREQUENCY} | {RADIO_CONSTANTS.CHANNEL_NAME}
                            </span>
                        </div>

                        <button
                            onClick={viewMode === 'player' ? handleShareSession : () => setViewMode('confirm')}
                            className={`p-2.5 rounded-full transition-colors border ${viewMode === 'player' ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20' : 'bg-white/5 hover:bg-white/10 border-white/10'}`}
                        >
                            {viewMode === 'player' ? <Share2 size={20} /> : <Plus size={20} />}
                        </button>
                    </header>

                    {/* Main Content */}
                    <main className="relative z-10 flex-1 flex flex-col items-center max-w-lg mx-auto w-full overflow-hidden">
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
                                onGenerate={generateRadio}
                                onCancel={() => setViewMode('list')}
                                error={error}
                            />
                        )}
                        {viewMode === 'loading' && (
                            <LoadingUI />
                        )}
                        {viewMode === 'player' && currentSession && (
                            <PlayerUI
                                session={currentSession}
                                currentLineIndex={currentLineIndex}
                                isPlaying={isPlaying}
                                progress={progress}
                                onTogglePlay={togglePlay}
                            />
                        )}
                    </main>

                    <audio
                        ref={audioRef}
                        src={currentSession?.audioUrl || ''}
                        onEnded={() => setIsPlaying(false)}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
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
                <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
                        <Radio className="text-white/30" size={32} />
                    </div>
                    <p className="text-white/40 text-sm mb-6">まだラジオがありません</p>
                    <button
                        onClick={onNew}
                        className="px-8 py-4 rounded-2xl bg-white text-black text-xs font-bold tracking-[0.2em] uppercase hover:bg-white/90 transition-all"
                    >
                        最初の番組を作る
                    </button>
                </div>
            ) : (
                <>
                    <div className="space-y-3 flex-1 overflow-y-auto scrollbar-hide mb-4">
                        {sessions.map((session) => (
                            <motion.div
                                key={session.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white/5 rounded-2xl border border-white/10 p-4 flex items-center gap-4 group"
                            >
                                <button
                                    onClick={() => onSelect(session)}
                                    className="flex-1 flex items-center gap-4 text-left"
                                >
                                    <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                                        <Play className="text-blue-400 ml-0.5" size={20} fill="currentColor" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-medium truncate">{session.title}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Clock size={10} className="text-white/30" />
                                            <span className="text-[10px] text-white/30">{formatDate(session.createdAt)}</span>
                                            {session.dateRange && (
                                                <span className="text-[10px] text-white/20">{session.dateRange}</span>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight size={18} className="text-white/20" />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(session.id);
                                    }}
                                    className="p-2 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-red-400 transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </motion.div>
                        ))}
                    </div>

                    <button
                        onClick={onNew}
                        className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white/60 text-xs font-bold tracking-[0.2em] uppercase hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                    >
                        <Plus size={16} />
                        新しい番組を生成
                    </button>
                </>
            )}
        </motion.div>
    );
}

function ConfirmUI({ 
    onGenerate, 
    onCancel, 
    error 
}: { 
    onGenerate: () => void; 
    onCancel: () => void;
    error: string | null;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-8 p-8 bg-white/5 rounded-[2.5rem] border border-white/10 backdrop-blur-2xl"
        >
            <div className="w-20 h-20 bg-gold-500/10 rounded-full flex items-center justify-center mx-auto border border-gold-500/20">
                <Radio className="text-gold-400" size={32} />
            </div>
            <div className="space-y-4">
                <h2 className="text-2xl font-light tracking-tight">Weekly George's Radio</h2>
                <p className="text-white/60 text-sm leading-relaxed">
                    １週間を振り返る番組を生成しますか？
                </p>
                <div className="p-4 bg-white/5 rounded-2xl flex items-start gap-3 text-left">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                    <p className="text-[11px] text-white/40 leading-normal italic">
                        生成には1分ほど時間がかかる場合があります。
                    </p>
                </div>
                {error && (
                    <p className="text-red-400/90 text-sm">{error}</p>
                )}
            </div>
            <div className="flex flex-col gap-3">
                <button
                    onClick={onGenerate}
                    className="w-full py-4 rounded-2xl bg-white text-black text-xs font-bold tracking-[0.2em] uppercase hover:bg-white/90 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                >
                    番組を生成する
                </button>
                <button
                    onClick={onCancel}
                    className="w-full py-4 rounded-2xl bg-transparent text-white/40 text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-white/5 transition-all"
                >
                    キャンセル
                </button>
            </div>
        </motion.div>
    );
}

function LoadingUI() {
    return (
        <div className="flex flex-col items-center gap-6">
            <div className="relative">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="w-20 h-20 border-t-2 border-blue-500 rounded-full"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                    <Radio className="text-blue-500/50 animate-pulse" size={28} />
                </div>
            </div>
            <div className="text-center space-y-4">
                <p className="text-white/80 font-light tracking-[0.2em] text-lg scanning-text uppercase">Scanning Signals...</p>
                <p className="text-white/20 text-[10px] tracking-[0.3em] uppercase">Connecting to Weekly Archive</p>
            </div>
        </div>
    );
}

function PlayerUI({ 
    session, 
    currentLineIndex, 
    isPlaying, 
    progress, 
    onTogglePlay 
}: { 
    session: RadioSession;
    currentLineIndex: number; 
    isPlaying: boolean;
    progress: number;
    onTogglePlay: () => void;
}) {
    return (
        <>
            {/* Title Section */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-center mb-12 w-full px-4"
            >
                <div className="inline-flex items-center px-2 py-1 mb-4 rounded-md bg-white/5 border border-white/10 gap-2">
                    <span className={`text-[8px] font-bold tracking-widest uppercase ${session.isNew ? 'text-yellow-400' : 'text-white/40'}`}>
                        {session.isNew ? '● NEW' : '● RECORDED'}
                    </span>
                    {session.dateRange && (
                        <span className="text-[8px] font-bold tracking-widest uppercase text-white/20 border-l border-white/10 pl-2">
                            {session.dateRange}
                        </span>
                    )}
                </div>

                <h1 className="text-3xl font-light tracking-tight mb-3 text-white">
                    {session.title}
                </h1>
                <div className="flex items-center justify-center gap-3">
                    <div className="h-[1px] w-8 bg-blue-500/30" />
                    <p className="text-[10px] tracking-[0.3em] uppercase text-blue-400/60 font-medium">{session.subtitle}</p>
                    <div className="h-[1px] w-8 bg-blue-500/30" />
                </div>
            </motion.div>

            {/* Portraits */}
            <div className="flex justify-center gap-16 w-full mb-16">
                {[
                    { name: 'George', emoji: '🤵‍♂️' },
                    { name: 'Aria', emoji: '🎙️' }
                ].map((person, idx) => (
                    <motion.div
                        key={person.name}
                        animate={isPlaying ? {
                            y: [0, -12, 0],
                            scale: [1, 1.05, 1],
                        } : {}}
                        transition={{
                            repeat: Infinity,
                            duration: 5,
                            delay: idx * 2.5,
                            ease: "easeInOut"
                        }}
                        className="flex flex-col items-center gap-5"
                    >
                        <div className={`w-28 h-28 rounded-full bg-gradient-to-b from-white/10 to-transparent border border-white/20 flex items-center justify-center text-5xl shadow-2xl relative ${isPlaying ? 'ring-2 ring-white/10 ring-offset-4 ring-offset-black transition-all' : ''}`}>
                            <span className="drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{person.emoji}</span>
                            {isPlaying && (
                                <motion.div
                                    className="absolute -right-1 -top-1 w-6 h-6 rounded-full bg-red-500 border-2 border-black flex items-center justify-center"
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ repeat: Infinity, duration: 2 }}
                                >
                                    <div className="w-1.5 h-1.5 rounded-full bg-white opacity-80" />
                                </motion.div>
                            )}
                        </div>
                        <span className={`text-[11px] font-bold tracking-[0.5em] uppercase transition-all duration-500 ${isPlaying ? 'text-blue-400 opacity-100' : 'text-white/20'}`}>
                            {person.name}
                        </span>
                    </motion.div>
                ))}
            </div>

            {/* Script Stream */}
            <div className="w-full h-44 overflow-y-auto mb-10 mask-fade-y scrollbar-hide">
                <div className="space-y-8 pb-32 pt-4">
                    {session.script.map((line, i) => (
                        <motion.div
                            key={i}
                            className={`flex flex-col gap-2 text-center transition-all duration-1000 ${currentLineIndex === i ? 'scale-105' : 'opacity-10 scale-90'}`}
                        >
                            <span className="text-[9px] tracking-[0.4em] uppercase text-blue-400/40 font-bold">{line.speaker}</span>
                            <p className="text-lg font-light leading-relaxed px-6 text-white/90">
                                {line.text}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Player Controls */}
            <div className="w-full max-w-sm bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-7 shadow-2xl">
                <div className="relative w-full h-1 bg-white/5 rounded-full mb-8 overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all duration-300 ease-linear"
                        style={{ width: `${progress * 100}%` }}
                    />
                </div>

                <div className="flex items-center justify-center">
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={onTogglePlay}
                        className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-105 transition-all outline-none"
                    >
                        {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                    </motion.button>
                </div>
            </div>
        </>
    );
}
