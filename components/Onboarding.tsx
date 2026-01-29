'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Heart, Flame, Zap, ChevronRight, Sparkles } from 'lucide-react';
import {
    Gender,
    PersonalityStyle,
    GeorgePersonality,
    VOICE_OPTIONS,
    DEFAULT_NAMES,
    STYLE_DESCRIPTIONS,
    getVoiceId,
    savePersonality,
    completeOnboarding
} from '@/lib/george/personality';

interface OnboardingProps {
    onComplete: (personality: GeorgePersonality) => void;
}

type Step = 'welcome' | 'gender' | 'style' | 'name' | 'complete';

export default function Onboarding({ onComplete }: OnboardingProps) {
    const [step, setStep] = useState<Step>('welcome');
    const [gender, setGender] = useState<Gender>('male');
    const [style, setStyle] = useState<PersonalityStyle>('gentle');
    const [name, setName] = useState('');

    const handleGenderSelect = (g: Gender) => {
        setGender(g);
        setName(DEFAULT_NAMES[g]);
        setStep('style');
    };

    const handleStyleSelect = (s: PersonalityStyle) => {
        setStyle(s);
        setStep('name');
    };

    const handleComplete = () => {
        const personality: GeorgePersonality = {
            name: name || DEFAULT_NAMES[gender],
            gender,
            style,
            voiceId: getVoiceId(gender, style),
        };
        savePersonality(personality);
        completeOnboarding();
        setStep('complete');

        setTimeout(() => {
            onComplete(personality);
        }, 1500);
    };

    return (
        <div className="fixed inset-0 bg-black flex items-center justify-center p-6">
            <AnimatePresence mode="wait">
                {/* Welcome */}
                {step === 'welcome' && (
                    <motion.div
                        key="welcome"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="text-center max-w-md"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring' }}
                            className="w-20 h-20 mx-auto mb-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center"
                        >
                            <Sparkles size={40} className="text-white" />
                        </motion.div>
                        <h1 className="text-3xl font-light mb-4 text-white">
                            ようこそ
                        </h1>
                        <p className="text-white/60 mb-8 leading-relaxed">
                            あなただけのタロット占い師を
                            <br />
                            一緒に作りましょう
                        </p>
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setStep('gender')}
                            className="px-8 py-4 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white flex items-center gap-2 mx-auto hover:bg-white/20 transition-colors"
                        >
                            はじめる
                            <ChevronRight size={20} />
                        </motion.button>
                    </motion.div>
                )}

                {/* Gender Selection */}
                {step === 'gender' && (
                    <motion.div
                        key="gender"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="text-center max-w-md w-full"
                    >
                        <h2 className="text-2xl font-light mb-2 text-white">
                            占い師のタイプ
                        </h2>
                        <p className="text-white/50 mb-8 text-sm">
                            声や話し方が変わります
                        </p>
                        <div className="space-y-3">
                            {[
                                { value: 'male' as Gender, label: '男性', icon: '👔', desc: '落ち着いた低い声' },
                                { value: 'female' as Gender, label: '女性', icon: '👗', desc: '凛とした優しい声' },
                                { value: 'neutral' as Gender, label: '中性的', icon: '✨', desc: '穏やかで中立的な声' },
                            ].map((option) => (
                                <motion.button
                                    key={option.value}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleGenderSelect(option.value)}
                                    className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-left flex items-center gap-4 hover:bg-white/10 transition-colors"
                                >
                                    <span className="text-2xl">{option.icon}</span>
                                    <div>
                                        <p className="text-white font-medium">{option.label}</p>
                                        <p className="text-white/40 text-sm">{option.desc}</p>
                                    </div>
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Style Selection */}
                {step === 'style' && (
                    <motion.div
                        key="style"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="text-center max-w-md w-full"
                    >
                        <h2 className="text-2xl font-light mb-2 text-white">
                            性格タイプ
                        </h2>
                        <p className="text-white/50 mb-8 text-sm">
                            どんな風に話してほしい？
                        </p>
                        <div className="space-y-3">
                            {[
                                { value: 'gentle' as PersonalityStyle, label: '優しめ', icon: <Heart className="text-pink-400" />, desc: '寄り添い、励ましてくれる' },
                                { value: 'strict' as PersonalityStyle, label: '厳しめ', icon: <Flame className="text-orange-400" />, desc: '甘やかさず、本質を突く' },
                                { value: 'sarcastic' as PersonalityStyle, label: '毒舌', icon: <Zap className="text-yellow-400" />, desc: '皮肉を交えつつ的確に' },
                            ].map((option) => (
                                <motion.button
                                    key={option.value}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleStyleSelect(option.value)}
                                    className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-left flex items-center gap-4 hover:bg-white/10 transition-colors"
                                >
                                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                        {option.icon}
                                    </div>
                                    <div>
                                        <p className="text-white font-medium">{option.label}</p>
                                        <p className="text-white/40 text-sm">{option.desc}</p>
                                    </div>
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Name Input */}
                {step === 'name' && (
                    <motion.div
                        key="name"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="text-center max-w-md w-full"
                    >
                        <h2 className="text-2xl font-light mb-2 text-white">
                            名前を決めよう
                        </h2>
                        <p className="text-white/50 mb-8 text-sm">
                            あなたの占い師の名前は？
                        </p>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={DEFAULT_NAMES[gender]}
                            className="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/20 text-white text-center text-xl placeholder-white/30 outline-none focus:border-cyan-500/50 transition-colors"
                        />
                        <p className="text-white/30 text-xs mt-3 mb-8">
                            空欄の場合は「{DEFAULT_NAMES[gender]}」になります
                        </p>
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={handleComplete}
                            className="px-8 py-4 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium flex items-center gap-2 mx-auto"
                        >
                            完了
                            <Sparkles size={20} />
                        </motion.button>
                    </motion.div>
                )}

                {/* Complete */}
                {step === 'complete' && (
                    <motion.div
                        key="complete"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center"
                    >
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, ease: 'linear' }}
                            className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center"
                        >
                            <Sparkles size={40} className="text-white" />
                        </motion.div>
                        <h2 className="text-2xl font-light text-white">
                            {name || DEFAULT_NAMES[gender]}が目覚めました
                        </h2>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
