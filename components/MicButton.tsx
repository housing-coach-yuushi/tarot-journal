'use client';

import { motion } from 'framer-motion';
import { Mic, MicOff, X } from 'lucide-react';

interface MicButtonProps {
    isListening: boolean;
    onToggle: () => void;
    onEnd?: () => void;
}

export default function MicButton({ isListening, onToggle, onEnd }: MicButtonProps) {
    return (
        <div className="flex items-center gap-4">
            {/* End Button */}
            {onEnd && (
                <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={onEnd}
                    className="p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/70 hover:bg-white/20 transition-colors"
                >
                    <X size={24} />
                </motion.button>
            )}

            {/* Main Mic Button */}
            <motion.button
                onClick={onToggle}
                whileTap={{ scale: 0.95 }}
                className={`relative p-6 rounded-full transition-all duration-300 ${isListening
                        ? 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/30'
                        : 'bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20'
                    }`}
            >
                {/* Pulse animation when listening */}
                {isListening && (
                    <>
                        <motion.div
                            className="absolute inset-0 rounded-full bg-purple-500/30"
                            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                        />
                        <motion.div
                            className="absolute inset-0 rounded-full bg-purple-500/20"
                            animate={{ scale: [1, 1.8], opacity: [0.3, 0] }}
                            transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }}
                        />
                    </>
                )}

                <motion.div
                    animate={{ scale: isListening ? 1.1 : 1 }}
                    transition={{ duration: 0.2 }}
                >
                    {isListening ? (
                        <Mic size={32} className="text-white" />
                    ) : (
                        <MicOff size={32} className="text-white/70" />
                    )}
                </motion.div>
            </motion.button>
        </div>
    );
}
