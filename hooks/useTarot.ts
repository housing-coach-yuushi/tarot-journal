'use client';

import { useState, useCallback } from 'react';
import { drawRandomCard, DrawnCard } from '@/lib/tarot/cards';

interface UseTarotOptions {
  onCardDrawn?: (card: DrawnCard, context: string) => void;
}

interface UseTarotReturn {
  isShuffleOpen: boolean;
  setIsShuffleOpen: (open: boolean) => void;
  processTarotDraw: () => DrawnCard | null;
}

export function useTarot(options: UseTarotOptions = {}): UseTarotReturn {
  const { onCardDrawn } = options;
  const [isShuffleOpen, setIsShuffleOpen] = useState(false);

  const processTarotDraw = useCallback((): DrawnCard | null => {
    setIsShuffleOpen(false);

    const card = drawRandomCard();
    const isReversed = Math.random() < 0.5;
    const drawnCard: DrawnCard = {
      card,
      position: isReversed ? 'reversed' : 'upright',
      isReversed,
    };

    // Generate context for AI
    const hour = new Date().getHours();
    const timeOfDay = (hour >= 5 && hour < 12) ? '朝' : '夜';
    const reflection = isReversed ? card.meaning.reversed : (
      (hour >= 5 && hour < 12) ? card.reflection.morning : card.reflection.evening
    );
    const positionText = isReversed ? '逆位置' : '正位置';
    const cardContext = `[タロットカードを引きました: ${card.name} ${card.symbol} - ${positionText}]\nキーワード: ${card.keywords.join('、')}\n問い: ${reflection}\n（${timeOfDay}のジャーナリングセッション）`;

    onCardDrawn?.(drawnCard, cardContext);

    return drawnCard;
  }, [onCardDrawn]);

  return {
    isShuffleOpen,
    setIsShuffleOpen,
    processTarotDraw,
  };
}
