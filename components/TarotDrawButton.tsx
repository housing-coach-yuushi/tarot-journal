'use client';

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { TarotCard as TarotCardType, drawRandomCard } from '@/lib/tarot/cards';

interface TarotDrawButtonProps {
  onCardDrawn?: (card: TarotCardType) => void;
  disabled?: boolean;
}

export default function TarotDrawButton({
  onCardDrawn,
  disabled = false,
}: TarotDrawButtonProps) {
  const handleDraw = useCallback(() => {
    const card = drawRandomCard();
    onCardDrawn?.(card);
  }, [onCardDrawn]);

  return (
    <motion.button
      onClick={handleDraw}
      disabled={disabled}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`
        p-4 rounded-full
        bg-white/10 backdrop-blur-sm 
        text-white/80 transition-all
        ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/20 hover:text-white'}
        border border-white/10 shadow-lg
      `}
      title="カードを引く"
    >
      <Sparkles size={24} />
    </motion.button>
  );
}
