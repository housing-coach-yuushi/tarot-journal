'use client';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

interface TapToStartProps {
  isLoading: boolean;
  isPreparing: boolean;
  initError: string | null;
  showTapHint: boolean;
  onTap: () => void;
  onRetry: () => void;
}

export default function TapToStart({
  isLoading,
  initError,
  showTapHint,
  onTap,
  onRetry,
}: TapToStartProps) {
  const prefersReducedMotion = useReducedMotion();
  const supportsPointerEvents = typeof window !== 'undefined' && 'PointerEvent' in window;

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[linear-gradient(160deg,#090b0e_0%,#12161e_55%,#080a0d_100%)]"
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif' }}
        >
          {/* Background effects */}
          <div className="pointer-events-none absolute inset-0">
            <motion.div
              animate={prefersReducedMotion ? undefined : { x: [0, 20, 0], y: [0, -12, 0] }}
              transition={prefersReducedMotion ? undefined : { duration: 8, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-16 -left-10 h-64 w-64 rounded-full bg-white/20 blur-3xl"
            />
            <motion.div
              animate={prefersReducedMotion ? undefined : { x: [0, -18, 0], y: [0, 14, 0] }}
              transition={prefersReducedMotion ? undefined : { duration: 10, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -bottom-16 -right-12 h-72 w-72 rounded-full bg-slate-200/15 blur-3xl"
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.18),transparent_38%),radial-gradient(circle_at_80%_100%,rgba(151,181,255,0.16),transparent_42%)]" />
          </div>

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="relative mx-6 w-full max-w-md rounded-[32px] border border-white/30 bg-white/10 px-8 py-10 backdrop-blur-2xl shadow-[0_24px_90px_rgba(0,0,0,0.5)]"
          >
            <div className="mx-auto mb-7 h-1.5 w-14 rounded-full bg-white/45" />

            <div className="mb-7 text-center">
              <p className="text-[11px] font-medium tracking-[0.20em] text-white/60">GEORGE TAROT JOURNAL</p>
              <h1 className="mt-4 text-[26px] font-semibold tracking-[0.02em] text-white">
                ジャーナルを始める
              </h1>
              <p className="mt-3 text-sm leading-relaxed tracking-[0.01em] text-white/68">
                準備ができたら、下のボタンを押してください。
              </p>
            </div>

            {/* Tap-to-start button */}
            <AnimatePresence>
              {showTapHint && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6 }}
                  onPointerUp={() => void onTap()}
                  onTouchEnd={!supportsPointerEvents ? () => void onTap() : undefined}
                  onClick={() => void onTap()}
                  aria-label="タップして始める"
                  className="group relative w-full overflow-hidden rounded-full bg-white px-8 py-4 transition-all active:scale-[0.985]"
                >
                  <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.95),rgba(242,246,255,0.9))]" />
                  <span className="pointer-events-none absolute inset-x-5 top-0 h-[1px] bg-white/90" />
                  <motion.p
                    animate={prefersReducedMotion ? undefined : { opacity: [0.85, 1, 0.85] }}
                    transition={prefersReducedMotion ? undefined : { repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                    className="relative text-base font-semibold tracking-[0.08em] text-slate-900"
                  >
                    タップして始める
                  </motion.p>
                </motion.button>
              )}
            </AnimatePresence>

            {/* Retry button on error */}
            {initError && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
                onClick={onRetry}
                className="mt-4 w-full rounded-full border border-white/25 bg-white/10 px-6 py-3 text-sm text-white/80 transition-colors hover:bg-white/15"
              >
                もう一度試す
              </motion.button>
            )}

            <p className="mt-5 text-center text-[11px] tracking-[0.12em] text-white/55">
              AUDIO READY
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
