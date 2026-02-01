
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useSound from 'use-sound';

interface TarotDeckShuffleProps {
    isOpen: boolean;
    onCardSelected: () => void;
    onClose?: () => void;
}

export function TarotDeckShuffle({ isOpen, onCardSelected, onClose }: TarotDeckShuffleProps) {
    const [playShuffle] = useSound('/sounds/shuffle.mp3', {
        volume: 1.0,
        onloaderror: (id, err) => console.error('🔊 Shuffle Load Error:', err),
        onplayerror: (id, err) => console.error('🔊 Shuffle Play Error:', err)
    });
    const [playDraw] = useSound('/sounds/draw.mp3', {
        volume: 1.0,
        onloaderror: (id, err) => console.error('🔊 Draw Load Error:', err),
        onplayerror: (id, err) => console.error('🔊 Draw Play Error:', err)
    });

    const [step, setStep] = useState<'intro' | 'shuffling' | 'spread' | 'selecting'>('intro');

    useEffect(() => {
        if (isOpen) {
            setStep('intro');

            // Auto sequence
            const t1 = setTimeout(() => {
                console.log('🔈 Shuffling sound triggered');
                setStep('shuffling');
                playShuffle();
            }, 600);

            const t2 = setTimeout(() => {
                setStep('spread');
            }, 2500);

            return () => {
                clearTimeout(t1);
                clearTimeout(t2);
            };
        }
    }, [isOpen, playShuffle]);

    const handleCardClick = () => {
        console.log('🔈 Draw sound triggered');
        playDraw();
        setStep('selecting');
        // Animate selection then callback
        setTimeout(() => {
            onCardSelected();
        }, 500);
    };

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md"
            onClick={onClose} // Click outside to close (optional, maybe distinct close button is better)
        >
            <div className="relative w-full h-96 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                <AnimatePresence mode='wait'>
                    {step === 'intro' && (
                        <motion.div
                            key="deck-intro"
                            initial={{ y: 50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative w-48 h-72 bg-indigo-900 rounded-xl border-2 border-white/20 shadow-2xl"
                        >
                            {/* Stack effect */}
                            <div className="absolute inset-0 bg-indigo-900 rounded-xl border border-white/10" style={{ transform: 'translateZ(-5px) translateY(2px)' }}></div>
                            <div className="absolute inset-0 bg-indigo-900 rounded-xl border border-white/10" style={{ transform: 'translateZ(-10px) translateY(4px)' }}></div>
                            {/* Icon removed as per user request */}
                        </motion.div>
                    )}

                    {step === 'shuffling' && (
                        <motion.div key="deck-shuffle" className="relative w-48 h-72">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <motion.div
                                    key={i}
                                    className="absolute inset-0 bg-gradient-to-br from-indigo-800 to-slate-900 rounded-xl border border-white/20 shadow-xl"
                                    animate={{
                                        x: [0, -100, 100, 0],
                                        rotate: [0, -15, 15, 0],
                                        zIndex: [0, 10, 0]
                                    }}
                                    transition={{
                                        duration: 1.5,
                                        repeat: Infinity,
                                        delay: i * 0.1,
                                        ease: "easeInOut"
                                    }}
                                />
                            ))}
                            <div className="absolute inset-0 flex items-center justify-center text-white/50 animate-pulse text-lg font-serif">
                                シャッフル中...
                            </div>
                        </motion.div>
                    )}

                    {step === 'spread' && (
                        <motion.div
                            key="deck-spread"
                            className="relative w-full max-w-4xl h-72 flex items-center justify-center perspective-1000"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            {/* Simulated Fan Spread */}
                            {Array.from({ length: 12 }).map((_, i) => {
                                const rotation = (i - 6) * 5; // -30 to +30 degrees
                                const xOffset = (i - 6) * 20;

                                return (
                                    <motion.div
                                        key={i}
                                        className="absolute w-40 h-64 bg-gradient-to-br from-indigo-900 to-black rounded-xl border border-white/30 cursor-pointer hover:border-yellow-400/50 hover:shadow-[0_0_15px_rgba(255,215,0,0.3)] origin-bottom"
                                        style={{
                                            x: xOffset,
                                            rotate: rotation,
                                            zIndex: i
                                        }}
                                        initial={{ y: 50, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: i * 0.05 }}
                                        whileHover={{ y: -30, scale: 1.1, zIndex: 100 }}
                                        onClick={handleCardClick}
                                    >
                                        <div className="w-full h-full flex items-center justify-center opacity-30">
                                            <span className="text-2xl">✨</span>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="mt-12 text-center" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-white text-2xl font-serif tracking-widest mb-2 font-noto-serif-jp">
                    {step === 'shuffling' ? 'エネルギーを浄化中...' : step === 'spread' ? 'カードを1枚選んでください' : 'デッキを準備中...'}
                </h2>
                <p className="text-white/40 text-sm">
                    {step === 'spread' ? '自分の直感を信じて' : ''}
                </p>
            </div>

        </motion.div>
    );
}
