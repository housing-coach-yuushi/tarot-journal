'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TarotCard as TarotCardType, getCardVideoUrl } from '@/lib/tarot/cards';
import { Loader2 } from 'lucide-react';

interface TarotCardProps {
  card: TarotCardType;
}

export default function TarotCard({ card }: TarotCardProps) {
  const [videoEnded, setVideoEnded] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Play video on mount
  useEffect(() => {
    if (videoRef.current && videoLoaded) {
      videoRef.current.play().catch(console.error);
    }
  }, [videoLoaded]);

  const handleVideoEnd = () => {
    setVideoEnded(true);
  };

  const handleVideoLoaded = () => {
    setVideoLoaded(true);
  };

  // Get reflection question based on time of day
  const getReflectionQuestion = () => {
    const hour = new Date().getHours();
    // Morning: 5-12, Evening: otherwise
    if (hour >= 5 && hour < 12) {
      return card.reflection.morning;
    }
    return card.reflection.evening;
  };

  return (
    <div className="w-full max-w-[200px]">
      {/* Card Video - Compact size */}
      <div className="relative rounded-xl overflow-hidden bg-black/30">
        <video
          ref={videoRef}
          src={getCardVideoUrl(card)}
          onEnded={handleVideoEnd}
          onLoadedData={handleVideoLoaded}
          playsInline
          muted
          autoPlay
          className="w-full aspect-[3/4] object-cover"
        />

        {/* Loading spinner */}
        {!videoLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="text-white/60"
            >
              <Loader2 size={24} />
            </motion.div>
          </div>
        )}

        {/* Card name overlay after video ends */}
        <AnimatePresence>
          {videoEnded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-lg">{card.symbol}</span>
                <span className="text-sm font-medium text-white">{card.name}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Reflection question - shows immediately with video */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-2"
      >
        <p className="text-white/70 text-xs leading-relaxed italic">
          {getReflectionQuestion()}
        </p>
      </motion.div>
    </div>
  );
}
