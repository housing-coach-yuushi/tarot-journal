'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface LiveCaptionProps {
    text: string;
    isTyping?: boolean;
}

export default function LiveCaption({ text, isTyping = false }: LiveCaptionProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center px-6"
        >
            <AnimatePresence mode="wait">
                <motion.p
                    key={text}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="text-2xl md:text-3xl font-light text-white/90 leading-relaxed max-w-2xl mx-auto"
                >
                    {text}
                    {isTyping && (
                        <motion.span
                            animate={{ opacity: [1, 0] }}
                            transition={{ repeat: Infinity, duration: 0.8 }}
                            className="inline-block w-0.5 h-6 bg-white/70 ml-1 align-middle"
                        />
                    )}
                </motion.p>
            </AnimatePresence>
        </motion.div>
    );
}
