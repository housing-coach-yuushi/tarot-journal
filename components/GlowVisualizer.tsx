'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface GlowVisualizerProps {
    isActive: boolean;
    audioLevel?: number;
}

export default function GlowVisualizer({ isActive, audioLevel = 0 }: GlowVisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | undefined>(undefined);

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

            const time = Date.now() * 0.001;
            const baseIntensity = isActive ? 0.8 + audioLevel * 0.5 : 0.3;
            const pulseIntensity = isActive
                ? baseIntensity + Math.sin(time * 2) * 0.2 + Math.sin(time * 3.5) * 0.1
                : baseIntensity + Math.sin(time * 0.8) * 0.05;

            // Main glow - aurora effect at bottom
            const glowHeight = height * (0.4 + (isActive ? 0.2 : 0));
            const glowY = height - glowHeight * 0.6;

            // Create radial gradient for the main glow
            const gradient = ctx.createRadialGradient(
                width / 2, height + 50, 0,
                width / 2, height + 50, glowHeight * 1.5
            );

            // Cyan/blue color like Gemini Live
            const alpha = pulseIntensity * 0.6;
            gradient.addColorStop(0, `rgba(0, 200, 255, ${alpha})`);
            gradient.addColorStop(0.3, `rgba(0, 150, 220, ${alpha * 0.7})`);
            gradient.addColorStop(0.6, `rgba(0, 100, 180, ${alpha * 0.3})`);
            gradient.addColorStop(1, 'rgba(0, 50, 100, 0)');

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            // Add subtle wave distortion when active
            if (isActive) {
                for (let i = 0; i < 3; i++) {
                    const waveGradient = ctx.createRadialGradient(
                        width / 2 + Math.sin(time + i) * 100,
                        height + 30,
                        0,
                        width / 2 + Math.sin(time + i) * 100,
                        height + 30,
                        glowHeight * (0.8 + i * 0.2)
                    );

                    const waveAlpha = (pulseIntensity * 0.3) / (i + 1);
                    waveGradient.addColorStop(0, `rgba(100, 220, 255, ${waveAlpha})`);
                    waveGradient.addColorStop(0.5, `rgba(50, 180, 230, ${waveAlpha * 0.5})`);
                    waveGradient.addColorStop(1, 'rgba(0, 100, 150, 0)');

                    ctx.fillStyle = waveGradient;
                    ctx.fillRect(0, 0, width, height);
                }
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 pointer-events-none"
        >
            <canvas
                ref={canvasRef}
                className="w-full h-full"
                style={{ display: 'block' }}
            />
        </motion.div>
    );
}
