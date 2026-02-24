'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Volume2, User, Bot, Bug, Compass, Sparkles, ShieldCheck } from 'lucide-react';

interface VoiceOption {
    id: string;
    name: string;
    gender: 'male' | 'female' | 'neutral';
    description: string;
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    currentAiName?: string;
    currentUserName?: string;
    currentVoiceId?: string;
    currentShowDebug?: boolean;
    currentBgmEnabled?: boolean;
    onSave: (settings: {
        aiName?: string;
        userName?: string;
        focusTheme?: string;
        futureWish?: string;
        nonNegotiables?: string;
        voiceId?: string;
        showDebug?: boolean;
        bgmEnabled?: boolean;
    }) => void;
}

export default function SettingsModal({
    isOpen,
    onClose,
    userId,
    currentAiName = '',
    currentUserName = '',
    currentVoiceId = '',
    currentShowDebug = false,
    currentBgmEnabled = false,
    onSave,
}: SettingsModalProps) {
    const [aiName, setAiName] = useState(currentAiName);
    const [userName, setUserName] = useState(currentUserName);
    const [focusTheme, setFocusTheme] = useState('');
    const [futureWish, setFutureWish] = useState('');
    const [nonNegotiables, setNonNegotiables] = useState('');
    const [voiceId, setVoiceId] = useState(currentVoiceId);
    const [showDebug, setShowDebug] = useState(currentShowDebug);
    const [bgmEnabled, setBgmEnabled] = useState(currentBgmEnabled);
    const [voices, setVoices] = useState<VoiceOption[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setShowDebug(currentShowDebug);
    }, [isOpen, currentShowDebug]);

    // Fetch available voices on mount
    useEffect(() => {
        if (isOpen) {
            const ts = Date.now();
            fetch(`/api/settings?userId=${encodeURIComponent(userId)}&_ts=${ts}`, { cache: 'no-store' })
                .then(res => res.json())
                .then(data => {
                    if (data.availableVoices) {
                        setVoices(data.availableVoices);
                    }
                    if (data.identity?.name) setAiName(data.identity.name);
                    if (data.identity?.voiceId) setVoiceId(data.identity.voiceId);
                    if (data.identity?.bgmEnabled !== undefined) setBgmEnabled(data.identity.bgmEnabled);
                    if (data.user?.displayName) setUserName(data.user.displayName);
                    setFocusTheme(typeof data.user?.focusTheme === 'string' ? data.user.focusTheme : '');
                    setFutureWish(typeof data.user?.futureWish === 'string' ? data.user.futureWish : '');
                    setNonNegotiables(typeof data.user?.nonNegotiables === 'string' ? data.user.nonNegotiables : '');
                })
                .catch(err => {
                    console.error('Failed to fetch settings:', err);
                    setError('設定の読み込みに失敗しました');
                });
        }
    }, [isOpen, userId]);

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);

        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    aiName: aiName || undefined,
                    userName: userName || undefined,
                    focusTheme: focusTheme || undefined,
                    futureWish: futureWish || undefined,
                    nonNegotiables: nonNegotiables || undefined,
                    voiceId: voiceId || undefined,
                    showDebug: showDebug,
                    bgmEnabled: bgmEnabled,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || '保存に失敗しました');
            }

            onSave({ aiName, userName, focusTheme, futureWish, nonNegotiables, voiceId, showDebug, bgmEnabled });
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : '保存に失敗しました');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-gray-900 border border-white/20 rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white">設定</h2>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                            >
                                <X size={20} className="text-white/60" />
                            </button>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Form Fields */}
                        <div className="space-y-5">
                            {/* AI Name */}
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-2">
                                    <Bot size={16} />
                                    AIの名前
                                </label>
                                <input
                                    type="text"
                                    value={aiName}
                                    onChange={(e) => setAiName(e.target.value)}
                                    placeholder="例: カイ"
                                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500 transition-colors"
                                />
                            </div>

                            {/* User Name */}
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-2">
                                    <User size={16} />
                                    あなたの名前
                                </label>
                                <input
                                    type="text"
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                    placeholder="例: ゆうさん"
                                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500 transition-colors"
                                />
                            </div>

                            {/* Focus Theme */}
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-2">
                                    <Compass size={16} />
                                    今のテーマ（任意）
                                </label>
                                <input
                                    type="text"
                                    value={focusTheme}
                                    onChange={(e) => setFocusTheme(e.target.value)}
                                    placeholder="例: 仕事 / 恋愛 / 試験 / 健康"
                                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500 transition-colors"
                                />
                            </div>

                            {/* Future Wish */}
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-2">
                                    <Sparkles size={16} />
                                    こうなったらいいな（任意）
                                </label>
                                <textarea
                                    value={futureWish}
                                    onChange={(e) => setFutureWish(e.target.value)}
                                    rows={3}
                                    placeholder="例: 焦りすぎず、毎日少しずつ前に進める状態になりたい"
                                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500 transition-colors resize-y"
                                />
                            </div>

                            {/* Non-Negotiables */}
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-2">
                                    <ShieldCheck size={16} />
                                    譲れない基準（任意）
                                </label>
                                <textarea
                                    value={nonNegotiables}
                                    onChange={(e) => setNonNegotiables(e.target.value)}
                                    rows={4}
                                    placeholder={'例:\n- 睡眠を削りすぎない\n- 嘘をつかない\n- 相手を雑に扱わない'}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500 transition-colors resize-y"
                                />
                                <p className="mt-2 text-xs text-white/45">
                                    箇条書きでも1文でもOK。まだ決まっていなければ空欄で大丈夫です。
                                </p>
                            </div>

                            {/* Voice Selection */}
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-2">
                                    <Volume2 size={16} />
                                    AIの声
                                </label>
                                <select
                                    value={voiceId}
                                    onChange={(e) => setVoiceId(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:outline-none focus:border-purple-500 transition-colors appearance-none cursor-pointer"
                                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'white\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.5rem' }}
                                >
                                    <option value="" className="bg-gray-900">声を選択...</option>
                                    <optgroup label="男性" className="bg-gray-900">
                                        {voices.filter(v => v.gender === 'male').map(voice => (
                                            <option key={voice.id} value={voice.id} className="bg-gray-900">
                                                {(voice as any).label || voice.name} - {voice.description}
                                            </option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="女性" className="bg-gray-900">
                                        {voices.filter(v => v.gender === 'female').map(voice => (
                                            <option key={voice.id} value={voice.id} className="bg-gray-900">
                                                {(voice as any).label || voice.name} - {voice.description}
                                            </option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>

                            {/* BGM Toggle */}
                            <div className="flex items-center justify-between p-1">
                                <label className="flex items-center gap-2 text-sm font-medium text-white/80">
                                    <Volume2 size={16} />
                                    BGM (静かなバー)
                                </label>
                                <button
                                    onClick={() => setBgmEnabled(!bgmEnabled)}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${bgmEnabled ? 'bg-purple-600' : 'bg-white/10'}`}
                                >
                                    <motion.div
                                        animate={{ x: bgmEnabled ? 28 : 4 }}
                                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                                    />
                                </button>
                            </div>

                            {/* Debug Toggle */}
                            <div className="flex items-center justify-between p-1">
                                <label className="flex items-center gap-2 text-sm font-medium text-white/80">
                                    <Bug size={16} />
                                    デバッグ表示
                                </label>
                                <button
                                    onClick={() => setShowDebug(!showDebug)}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${showDebug ? 'bg-purple-600' : 'bg-white/10'}`}
                                >
                                    <motion.div
                                        animate={{ x: showDebug ? 28 : 4 }}
                                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                                    />
                                </button>
                            </div>
                        </div>

                        {/* Save Button */}
                        <div className="mt-8">
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="w-full py-3 px-6 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 disabled:cursor-not-allowed rounded-xl text-white font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                {isSaving ? (
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                    >
                                        <Save size={18} />
                                    </motion.div>
                                ) : (
                                    <>
                                        <Save size={18} />
                                        保存
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
