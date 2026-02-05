import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, X, Radio, Loader2, Volume2, SkipForward, SkipBack, ArrowLeft, Save, Share2 } from 'lucide-react';
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
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const analyzerRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

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

    // Initial check when opened
    useEffect(() => {
        if (isOpen && !audioUrl && !isLoading && !isConfirming) {
            setIsConfirming(true);
        }
    }, [isOpen, audioUrl, isLoading]);

    // Setup Audio Analyzer for reactive aurora
    useEffect(() => {
        if (!audioRef.current || !audioUrl) return;

        const setupAudio = async () => {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const audioContext = audioContextRef.current;

            if (!analyzerRef.current) {
                const source = audioContext.createMediaElementSource(audioRef.current!);
                const analyzer = audioContext.createAnalyser();
                analyzer.fftSize = 256;
                source.connect(analyzer);
                analyzer.connect(audioContext.destination);
                analyzerRef.current = analyzer;
            }

            const updateLevel = () => {
                if (analyzerRef.current && isPlaying) {
                    const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
                    analyzerRef.current.getByteFrequencyData(dataArray);
                    const average = dataArray.reduce((src, val) => src + val, 0) / dataArray.length;
                    setAudioLevel(average / 150);
                } else {
                    setAudioLevel(0);
                }
                animationFrameRef.current = requestAnimationFrame(updateLevel);
            };

            updateLevel();
        };

        setupAudio();

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [audioUrl, isPlaying]);

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
                const data = await response.json();
                throw new Error(data.error || 'ラジオの生成に失敗しました。');
            }

            const data = await response.json();
            setAudioUrl(data.audioUrl);
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
                    className="fixed inset-0 z-[200] bg-black flex flex-col p-6 text-white safe-area-inset overflow-hidden"
                >
                    {/* Background Aurora Effect */}
                    <div className="absolute inset-x-0 bottom-0 h-3/4 pointer-events-none opacity-60">
                        <GlowVisualizer isActive={isPlaying} audioLevel={audioLevel} />
                    </div>

                    {/* Header */}
                    <div className="relative z-10 flex items-center justify-between mb-8">
                        <button
                            onClick={onClose}
                            className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
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
                                <span className={`text-[10px] font-bold tracking-[0.4em] uppercase mr-[-0.4em] ${isPlaying ? 'text-white' : 'text-white/30'}`}>
                                    {isPlaying ? 'ON AIR' : 'OFF AIR'}
                                </span>
                            </div>
                            <span className="text-[8px] font-medium tracking-[0.2em] text-white/20">88.1 MHz | GEORGE'S CHANNEL</span>
                        </div>

                        <button
                            onClick={handleShareSession}
                            className="p-2.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors border border-blue-500/20"
                        >
                            <Share2 size={20} />
                        </button>
                    </div>

                    {/* Main Content */}
                    <div className="relative z-10 flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full">
                        {isConfirming ? (
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
                                            生成には1分ほど時間がかかる場合があります。この画面を閉じても、準備ができたら通知でお知らせします。
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={generateRadio}
                                        className="w-full py-4 rounded-2xl bg-white text-black text-xs font-bold tracking-[0.2em] uppercase hover:bg-white/90 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
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
                            <div className="text-center space-y-6 bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-xl">
                                <p className="text-red-400/90 text-sm leading-relaxed">{error}</p>
                                <button
                                    onClick={() => setIsConfirming(true)}
                                    className="w-full py-4 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-bold tracking-widest uppercase hover:bg-blue-600/30 transition-all"
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
                                    className="text-center mb-12 w-full px-4"
                                >
                                    <div className="inline-flex items-center px-2 py-1 mb-4 rounded-md bg-white/5 border border-white/10 gap-2">
                                        <span className={`text-[8px] font-bold tracking-widest uppercase ${isNew ? 'text-yellow-400' : 'text-white/40'}`}>
                                            {isNew ? '● NEW BROADCAST' : '● RECORDED SESSION'}
                                        </span>
                                        {dateRange && (
                                            <span className="text-[8px] font-bold tracking-widest uppercase text-white/20 border-l border-white/10 pl-2">
                                                {dateRange}
                                            </span>
                                        )}
                                    </div>

                                    <h1 className="text-3xl font-light tracking-tight mb-3 text-white">
                                        {title || "Weekly George's Radio"}
                                    </h1>
                                    <div className="flex items-center justify-center gap-3">
                                        <div className="h-[1px] w-8 bg-blue-500/30" />
                                        <p className="text-[10px] tracking-[0.3em] uppercase text-blue-400/60 font-medium">{subtitle}</p>
                                        <div className="h-[1px] w-8 bg-blue-500/30" />
                                    </div>
                                </motion.div>

                                {/* Floating Portraits */}
                                <div className="flex justify-center gap-16 w-full mb-16">
                                    {[
                                        { name: 'George', emoji: '🤵‍♂️', color: 'from-blue-600/30' },
                                        { name: 'Aria', emoji: '🎙️', color: 'from-cyan-600/30' }
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

                                {/* Dialogue Stream */}
                                <div className="w-full h-44 overflow-y-auto mb-10 mask-fade-y scrollbar-hide">
                                    <div className="space-y-8 pb-32 pt-4">
                                        {script.map((line, i) => (
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

                                    <div className="flex items-center justify-between px-6">
                                        <button className="text-white/30 hover:text-white transition-colors p-2">
                                            <SkipBack size={24} />
                                        </button>

                                        <motion.button
                                            whileTap={{ scale: 0.9 }}
                                            onClick={togglePlay}
                                            className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-105 transition-all outline-none"
                                        >
                                            {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                                        </motion.button>

                                        <button className="text-white/30 hover:text-white transition-colors p-2">
                                            <SkipForward size={24} />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <audio
                        ref={audioRef}
                        src={audioUrl || ''}
                        onEnded={() => setIsPlaying(false)}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
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
                    `}</style>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
