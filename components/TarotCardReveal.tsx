'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DrawnCard } from '@/lib/tarot/cards';

interface TarotCardRevealProps {
    drawnCard: DrawnCard;
    onRevealComplete?: () => void;
    className?: string;
}

import useSound from 'use-sound';

export function TarotCardReveal({ drawnCard, onRevealComplete, className = '' }: TarotCardRevealProps) {
    const [isFlipped, setIsFlipped] = useState(false);
    const [showEffects, setShowEffects] = useState(false);
    const [playFlip] = useSound('/sounds/flip.mp3', { volume: 0.4 });

    // Auto flip or manual? Let's make it manual for interaction, but maybe auto for now for smooth flow
    // User wants "Wow" factor. Tap to flip is better.

    const handleFlip = () => {
        if (isFlipped) return;

        playFlip();

        // Haptic feedback if available
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(20);
        }

        setIsFlipped(true);
        setTimeout(() => setShowEffects(true), 500);
        if (onRevealComplete) {
            setTimeout(onRevealComplete, 1500);
        }
    };

    // Auto-flip for UX (users might not realize they need to tap)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!isFlipped) handleFlip();
        }, 800);
        return () => clearTimeout(timer);
    }, [isFlipped]);

    return (
        <div className={`perspective-1000 w-full max-w-sm aspect-[2/3] relative ${className}`}>
            <motion.div
                className="w-full h-full relative transition-all duration-1000 transform-style-3d cursor-pointer"
                style={{ transformStyle: 'preserve-3d' }}
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                onClick={handleFlip}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                {/* Back of Card */}
                <div
                    className="absolute inset-0 w-full h-full bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl border-2 border-white/10 shadow-2xl flex items-center justify-center backface-hidden"
                    style={{ backfaceVisibility: 'hidden' }}
                >
                    {/* Card Back Pattern */}
                    <div className="absolute inset-2 border border-white/5 rounded-xl flex items-center justify-center opacity-50">
                        <div className="w-24 h-24 rounded-full border border-white/10 flex items-center justify-center">
                            {/* Icon removed as per user request */}
                        </div>
                    </div>
                    <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>
                </div>

                {/* Front of Card */}
                <div
                    className="absolute inset-0 w-full h-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 backface-hidden rotate-y-180"
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                    {/* Main Image */}
                    {drawnCard.card.image ? (
                        <motion.img
                            src={drawnCard.card.image}
                            alt={drawnCard.card.name}
                            className={`w-full h-full object-cover ${drawnCard.isReversed ? 'rotate-180' : ''}`}
                        />
                    ) : (
                        // Fallback for cards without generated image
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                            <span className="text-white">画像を生成中...</span>
                        </div>
                    )}

                    {/* Shine Effect */}
                    <AnimatePresence>
                        {isFlipped && (
                            <motion.div
                                initial={{ x: '-100%', opacity: 0 }}
                                animate={{ x: '200%', opacity: 0.3 }}
                                transition={{ duration: 1.5, ease: "easeInOut", delay: 0.2 }}
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent -skew-x-12"
                                style={{ width: '50%' }}
                            />
                        )}
                    </AnimatePresence>

                    {/* Card Info Overlay */}
                    <div className={`absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent ${drawnCard.isReversed ? 'rotate-180' : ''}`}>
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="font-noto-serif-jp"
                        >
                            <h3 className="text-white text-xl tracking-widest">{drawnCard.card.nameEn}</h3>
                            <p className="text-white/60 text-sm font-light mt-1">{drawnCard.card.name}</p>
                        </motion.div>
                    </div>

                    {drawnCard.isReversed && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-red-500/50 text-red-500 px-3 py-1 text-xs font-bold tracking-widest uppercase rounded bg-black/50 backdrop-blur-sm rotate-180 font-noto-serif-jp">
                            逆位置
                        </div>
                    )}

                </div>
            </motion.div>

            {/* Instructional Text */}
            {!isFlipped && (
                <motion.div
                    className="absolute -bottom-12 left-0 right-0 text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                >
                    <p className="text-white/50 text-sm animate-pulse font-noto-serif-jp">タップしてめくる</p>
                </motion.div>
            )}
        </div>
    );
}
