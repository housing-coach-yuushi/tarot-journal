import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Radio, SkipForward, SkipBack, ArrowLeft, Share2, Disc3 } from 'lucide-react';
import GlowVisualizer from './GlowVisualizer';

interface RadioLine {
    speaker: string;
    text: string;
}

interface GeorgeRadioProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    userName: string;
    onGenerationComplete?: (title: string) => void;
}

export default function GeorgeRadio({ isOpen, onClose, userId, userName, onGenerationComplete }: GeorgeRadioProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [dateRange, setDateRange] = useState('');
    const [script, setScript] = useState<RadioLine[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isNew, setIsNew] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentLineIndex, setCurrentLineIndex] = useState(0);
    const [audioLevel, setAudioLevel] = useState(0);
    const [progress, setProgress] = useState(0);
    const [isAudioReady, setIsAudioReady] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const eqBars = [0.35, 0.6, 0.45, 0.8, 0.5, 0.65, 0.42, 0.72];
    const coverImageUrl = '/icon-options/george_illustrative.png';
    const hostVisuals = {
        George: '/icon-options/mystic_gold_mic_v2.png',
        Aria: '/icon-options/apple_voice_tarot.png',
    } as const;

    // Track audio progress and estimate current line
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            if (audio.duration && isFinite(audio.duration)) {
                const pct = audio.currentTime / audio.duration;
                setProgress(pct);

                // Estimate current line based on progress
                if (script.length > 0) {
                    const idx = Math.min(
                        Math.floor(pct * script.length),
                        script.length - 1
                    );
                    setCurrentLineIndex(idx);
                }
            }
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
    }, [script]);

    // Reset modal state each time it opens to avoid stale script/audio URLs.
    useEffect(() => {
        if (!isOpen) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            setIsPlaying(false);
            return;
        }

        setIsLoading(false);
        setIsConfirming(true);
        setError(null);
        setAudioUrl(null);
        setTitle('');
        setSubtitle('');
        setDateRange('');
        setScript([]);
        setIsNew(false);
        setCurrentLineIndex(0);
        setProgress(0);
        setIsAudioReady(false);
    }, [isOpen]);

    // Simple reactive level without WebAudio routing to avoid Safari/iOS silent playback.
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

    // Reset audio element state when source changes.
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        setIsPlaying(false);
        setProgress(0);
        audio.currentTime = 0;
        if (audioUrl) {
            audio.load();
        }
    }, [audioUrl]);

    const generateRadio = async () => {
        setIsLoading(true);
        setIsConfirming(false);
        setError(null);
        try {
            const response = await fetch('/api/journal/radio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, userName }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                if (response.status === 404) {
                    throw new Error('まだ週次ラジオを作れる日記がありません。先にチェックインを1件以上保存してください。');
                }
                throw new Error(data.error || 'ラジオの生成に失敗しました。');
            }

            const data = await response.json();
            if (!data.audioUrl || typeof data.audioUrl !== 'string') {
                throw new Error('音声URLが返ってきませんでした。時間をおいて再試行してください。');
            }
            setAudioUrl(data.audioUrl);
            setIsAudioReady(false);
            setTitle(data.title);
            setSubtitle(data.subtitle || 'Weekly Focus Session');
            setScript(data.script);
            setIsNew(data.isNew);
            if (data.startDate && data.endDate) {
                const start = new Date(data.startDate);
                const end = new Date(data.endDate);
                const format = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
                setDateRange(`${format(start)} - ${format(end)}`);
            }

            // Notify completion if component is "closed" (background)
            if (onGenerationComplete) {
                onGenerationComplete(data.title);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const togglePlay = async () => {
        if (!audioRef.current) return;
        if (!audioUrl) {
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

    const playFromStart = async () => {
        const audio = audioRef.current;
        if (!audio || !audioUrl) return;
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
        if (script.length === 0) {
            alert('共有する内容がありません');
            return;
        }

        try {
            // Convert radio script to messages format for the format-share API
            const messages = script.map(line => ({
                role: line.speaker.toLowerCase() === 'george' ? 'assistant' : 'user',
                content: `[${line.speaker}] ${line.text}`,
            }));

            const response = await fetch('/api/journal/format-share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages }),
            });

            let shareTitle = title || '今日のラジオ';
            let shareText = '';

            if (response.ok) {
                const data = await response.json();
                shareTitle = data.title || shareTitle;
                shareText = data.text || '';
            } else {
                // Fallback: raw script
                shareText = script.map(line => `${line.speaker}: ${line.text}`).join('\n\n');
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
                // Fallback: Copy to clipboard
                try {
                    await navigator.clipboard.writeText(shareText);
                    alert('クリップボードにコピーしました！\nジャーナルアプリなどに貼り付けてください。');
                } catch (err) {
                    console.error('コピー失敗:', err);
                }
            }
        } catch (error) {
            console.error('共有準備エラー:', error);
            alert('共有の準備に失敗しました');
        }
    };

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
                            backgroundImage: `url(${coverImageUrl})`,
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
                            onClick={onClose}
                            className="p-2.5 rounded-full bg-white/5 hover:bg-white/15 transition-colors border border-white/10"
                        >
                            <ArrowLeft size={20} />
                        </button>

                        <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-2">
                                <motion.div
                                    animate={isPlaying ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
                                    transition={{ repeat: Infinity, duration: 1.5 }}
                                    className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-white/20'}`}
                                />
                                <span className={`text-[10px] font-bold tracking-[0.32em] uppercase mr-[-0.32em] ${isPlaying ? 'text-cyan-100' : 'text-white/35'}`}>
                                    {isPlaying ? 'ON AIR' : 'OFF AIR'}
                                </span>
                            </div>
                            <span className="text-[8px] font-medium tracking-[0.2em] text-white/30">88.1 MHz | GEORGE'S CHANNEL</span>
                        </div>

                        <button
                            onClick={handleShareSession}
                            className="p-2.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 transition-colors border border-cyan-400/30"
                        >
                            <Share2 size={20} />
                        </button>
                    </div>

                    {/* Main Content */}
                    <div className="relative z-10 flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
                        {isConfirming ? (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-center space-y-8 p-8 bg-white/5 rounded-[2.5rem] border border-white/10 backdrop-blur-2xl shadow-[0_22px_60px_rgba(0,0,0,0.55)]"
                            >
                                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-cyan-300/30 bg-cyan-400/10 shadow-[0_0_40px_rgba(34,211,238,0.25)]">
                                    <Radio className="text-cyan-200" size={32} />
                                </div>
                                <div className="space-y-4">
                                    <h2 className="text-2xl font-light tracking-tight">Weekly George's Radio</h2>
                                    <p className="text-white/60 text-sm leading-relaxed">
                                        １週間を振り返る番組を生成しますか？
                                    </p>
                                    <div className="p-4 bg-white/5 rounded-2xl flex items-start gap-3 text-left">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                                        <p className="text-[11px] text-white/40 leading-normal italic">
                                            生成には1分ほど時間がかかる場合があります。この画面を閉じても、準備ができたら通知でお知らせします。
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={generateRadio}
                                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-200 to-blue-200 text-[#021322] text-xs font-bold tracking-[0.2em] uppercase hover:brightness-110 transition-all shadow-[0_0_24px_rgba(125,211,252,0.5)]"
                                    >
                                        番組を生成する
                                    </button>
                                    <button
                                        onClick={onClose}
                                        className="w-full py-4 rounded-2xl bg-transparent text-white/40 text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-white/5 transition-all"
                                    >
                                        今はやめておく
                                    </button>
                                </div>
                            </motion.div>
                        ) : isLoading ? (
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
                                    <div className="flex flex-col items-center gap-2">
                                        <p className="text-white/20 text-[10px] tracking-[0.3em] uppercase">Connecting to Weekly Archive</p>
                                        <button
                                            onClick={onClose}
                                            className="px-4 py-2 rounded-full border border-white/5 bg-white/5 text-[9px] text-white/30 uppercase tracking-widest hover:bg-white/10 transition-all mt-4"
                                        >
                                            閉じて待つ
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : error ? (
                            <div className="text-center space-y-6 bg-white/5 p-8 rounded-[2rem] border border-red-400/30 backdrop-blur-xl">
                                <p className="text-red-200/95 text-sm leading-relaxed">{error}</p>
                                <button
                                    onClick={() => setIsConfirming(true)}
                                    className="w-full py-4 rounded-2xl bg-cyan-600/20 text-cyan-200 border border-cyan-400/30 text-xs font-bold tracking-widest uppercase hover:bg-cyan-600/30 transition-all"
                                >
                                    Retry Connection
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Session Title Section */}
                                <motion.div
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="text-center mb-8 w-full px-4"
                                >
                                    <div className="mb-4 w-full flex justify-center">
                                        <div className="w-full max-w-xl rounded-2xl overflow-hidden border border-cyan-100/20 shadow-[0_12px_35px_rgba(0,0,0,0.45)]">
                                            <img
                                                src={coverImageUrl}
                                                alt="Weekly Radio Cover"
                                                className="w-full h-36 sm:h-44 object-cover"
                                                loading="lazy"
                                            />
                                        </div>
                                    </div>
                                    <div className="inline-flex items-center px-3 py-1.5 mb-4 rounded-full bg-white/5 border border-white/15 gap-2">
                                        <span className={`text-[8px] font-bold tracking-widest uppercase ${isNew ? 'text-cyan-200' : 'text-white/45'}`}>
                                            {isNew ? '● NEW BROADCAST' : '● RECORDED SESSION'}
                                        </span>
                                        {dateRange && (
                                            <span className="text-[8px] font-bold tracking-widest uppercase text-white/25 border-l border-white/10 pl-2">
                                                {dateRange}
                                            </span>
                                        )}
                                    </div>

                                    <h1 className="text-3xl sm:text-4xl font-light tracking-tight mb-2 text-white">
                                        {title || "Weekly George's Radio"}
                                    </h1>
                                    <div className="flex items-center justify-center gap-3">
                                        <div className="h-[1px] w-10 bg-cyan-300/25" />
                                        <p className="text-[10px] tracking-[0.28em] uppercase text-cyan-100/70 font-medium">{subtitle}</p>
                                        <div className="h-[1px] w-10 bg-cyan-300/25" />
                                    </div>
                                </motion.div>

                                {/* Floating Portraits */}
                                <div className="flex justify-center gap-10 sm:gap-16 w-full mb-10">
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
                                            className="flex flex-col items-center gap-4"
                                        >
                                            <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-b from-cyan-100/15 to-transparent border border-cyan-100/20 flex items-center justify-center text-4xl sm:text-5xl shadow-2xl relative overflow-hidden ${isPlaying ? 'ring-2 ring-cyan-200/30 ring-offset-4 ring-offset-[#040914] transition-all' : ''}`}>
                                                <Disc3 size={66} className={`absolute text-white/10 ${isPlaying ? 'animate-spin [animation-duration:6s]' : ''}`} />
                                                <img
                                                    src={hostVisuals[person.name as keyof typeof hostVisuals]}
                                                    alt={`${person.name} visual`}
                                                    className="absolute inset-0 w-full h-full object-cover opacity-80"
                                                />
                                                <span className="drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] relative">{person.emoji}</span>
                                                {isPlaying && (
                                                    <motion.div
                                                        className="absolute -right-1 -top-1 w-6 h-6 rounded-full bg-red-500 border-2 border-[#050710] flex items-center justify-center"
                                                        animate={{ scale: [1, 1.2, 1] }}
                                                        transition={{ repeat: Infinity, duration: 2 }}
                                                    >
                                                        <div className="w-1.5 h-1.5 rounded-full bg-white opacity-80" />
                                                    </motion.div>
                                                )}
                                            </div>
                                            <span className={`text-[10px] sm:text-[11px] font-bold tracking-[0.42em] uppercase transition-all duration-500 ${isPlaying ? 'text-cyan-100 opacity-100' : 'text-white/25'}`}>
                                                {person.name}
                                            </span>
                                        </motion.div>
                                    ))}
                                </div>

                                {/* Dialogue Stream */}
                                <div className="w-full h-52 overflow-y-auto mb-8 mask-fade-y scrollbar-hide rounded-3xl border border-white/10 bg-[#060b14]/80 backdrop-blur-xl px-4 sm:px-8 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                                    <div className="space-y-7 pb-24 pt-2">
                                        {script.map((line, i) => (
                                            <motion.div
                                                key={i}
                                                className={`flex flex-col gap-1 text-center transition-all duration-700 ${currentLineIndex === i ? 'scale-100 opacity-100' : 'opacity-35 scale-[0.98]'}`}
                                            >
                                                <span className={`text-[9px] tracking-[0.35em] uppercase font-bold ${currentLineIndex === i ? 'text-cyan-200/90' : 'text-white/35'}`}>{line.speaker}</span>
                                                <p className={`text-base sm:text-lg font-light leading-relaxed px-3 sm:px-6 ${currentLineIndex === i ? 'text-white' : 'text-white/50'}`}>
                                                    {line.text}
                                                </p>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>

                                {/* Player Controls */}
                                <div className="w-full max-w-md bg-[#070d18]/90 backdrop-blur-3xl border border-cyan-100/15 rounded-[2.4rem] p-6 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
                                    <div className="relative w-full h-1 bg-white/10 rounded-full mb-6 overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-cyan-300 via-blue-300 to-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.45)] transition-all duration-300 ease-linear"
                                            style={{ width: `${progress * 100}%` }}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between mb-6 px-2 sm:px-6">
                                        <button
                                            onClick={() => seekBy(-15)}
                                            className="text-white/40 hover:text-cyan-100 transition-colors p-2"
                                            aria-label="15秒戻る"
                                        >
                                            <SkipBack size={24} />
                                        </button>

                                        <motion.button
                                            whileTap={{ scale: 0.9 }}
                                            onClick={togglePlay}
                                            className="w-20 h-20 rounded-full bg-gradient-to-b from-cyan-100 to-cyan-300 text-[#02111d] flex items-center justify-center shadow-[0_12px_30px_rgba(34,211,238,0.4)] hover:scale-105 transition-all outline-none"
                                        >
                                            {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                                        </motion.button>

                                        <button
                                            onClick={() => seekBy(15)}
                                            className="text-white/40 hover:text-cyan-100 transition-colors p-2"
                                            aria-label="15秒進む"
                                        >
                                            <SkipForward size={24} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-8 gap-1.5 items-end h-8">
                                        {eqBars.map((bar, i) => (
                                            <motion.span
                                                key={i}
                                                className="rounded-full bg-gradient-to-t from-cyan-500/80 to-cyan-100/90"
                                                animate={isPlaying ? { height: [`${10 + bar * 12}px`, `${16 + bar * 28}px`, `${8 + bar * 20}px`] } : { height: '8px', opacity: 0.45 }}
                                                transition={{ duration: 0.9 + (i % 3) * 0.25, repeat: Infinity, ease: 'easeInOut' }}
                                            />
                                        ))}
                                    </div>

                                    <div className="mt-5 flex flex-col sm:flex-row gap-2">
                                        <button
                                            onClick={togglePlay}
                                            disabled={!audioUrl}
                                            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold tracking-wide border transition-colors ${
                                                audioUrl
                                                    ? 'border-cyan-300/40 bg-cyan-200/10 text-cyan-100 hover:bg-cyan-200/20'
                                                    : 'border-white/10 bg-white/5 text-white/40 cursor-not-allowed'
                                            }`}
                                        >
                                            {isPlaying ? '音声を停止' : (isAudioReady ? '音声を再生' : '読み込み中...')}
                                        </button>
                                        <button
                                            onClick={playFromStart}
                                            disabled={!audioUrl}
                                            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold tracking-wide border transition-colors ${
                                                audioUrl
                                                    ? 'border-white/20 bg-white/10 text-white/90 hover:bg-white/20'
                                                    : 'border-white/10 bg-white/5 text-white/40 cursor-not-allowed'
                                            }`}
                                        >
                                            最初から再生
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <audio
                        ref={audioRef}
                        src={audioUrl || ''}
                        preload="auto"
                        playsInline
                        onLoadStart={() => setIsAudioReady(false)}
                        onCanPlay={() => setIsAudioReady(true)}
                        onLoadedData={() => setIsAudioReady(true)}
                        onEnded={() => setIsPlaying(false)}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onError={() => {
                            setIsPlaying(false);
                            const audio = audioRef.current;
                            const src = audio?.currentSrc || audio?.getAttribute('src') || '';
                            setError(`音声の読み込みに失敗しました: ${src ? src.slice(0, 120) : 'src不明'}`);
                        }}
                    />

                    <style jsx>{`
                        .mask-fade-y {
                            mask-image: linear-gradient(to bottom, transparent, black 15%, black 85%, transparent);
                            -webkit-mask-image: linear-gradient(to bottom, transparent, black 15%, black 85%, transparent);
                        }
                        .scrollbar-hide::-webkit-scrollbar {
                            display: none;
                        }
                        .scrollbar-hide {
                            -ms-overflow-style: none;
                            scrollbar-width: none;
                        }
                        @keyframes scan {
                            0% { opacity: 0.3; }
                            50% { opacity: 1; }
                            100% { opacity: 0.3; }
                        }
                        .scanning-text {
                            animation: scan 1.5s infinite ease-in-out;
                        }
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
