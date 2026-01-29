'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface VisualizerProps {
    isActive: boolean;
    audioLevel?: number;
}

export default function Visualizer({ isActive, audioLevel = 0 }: VisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | undefined>(undefined);
    const [bars, setBars] = useState<number[]>(Array(32).fill(0));

    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resizeCanvas = () => {
            canvas.width = canvas.offsetWidth * window.devicePixelRatio;
            canvas.height = canvas.offsetHeight * window.devicePixelRatio;
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        const animate = () => {
            const width = canvas.offsetWidth;
            const height = canvas.offsetHeight;

            ctx.clearRect(0, 0, width, height);

            // Create gradient
            const gradient = ctx.createLinearGradient(0, height / 2 - 50, 0, height / 2 + 50);
            gradient.addColorStop(0, '#4f46e5');
            gradient.addColorStop(0.5, '#7c3aed');
            gradient.addColorStop(1, '#c026d3');

            const barCount = 32;
            const barWidth = width / barCount - 2;
            const centerY = height / 2;

            for (let i = 0; i < barCount; i++) {
                // Generate wave-like animation
                const time = Date.now() * 0.002;
                const baseHeight = isActive
                    ? Math.sin(time + i * 0.2) * 30 + Math.sin(time * 1.5 + i * 0.3) * 20 + (audioLevel * 50)
                    : Math.sin(time * 0.5 + i * 0.1) * 5 + 5;

                const barHeight = Math.max(4, Math.abs(baseHeight));
                const x = i * (barWidth + 2);

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.roundRect(x, centerY - barHeight / 2, barWidth, barHeight, 4);
                ctx.fill();
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isActive, audioLevel]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full h-32 relative"
        >
            <canvas
                ref={canvasRef}
                className="w-full h-full"
                style={{ display: 'block' }}
            />
            <AnimatePresence>
                {isActive && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 blur-3xl -z-10"
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
}
