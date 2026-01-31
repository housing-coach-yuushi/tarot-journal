'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Volume2, User, Bot } from 'lucide-react';

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
    onSave: (settings: { aiName?: string; userName?: string; voiceId?: string }) => void;
}

export default function SettingsModal({
    isOpen,
    onClose,
    userId,
    currentAiName = '',
    currentUserName = '',
    currentVoiceId = '',
    onSave,
}: SettingsModalProps) {
    const [aiName, setAiName] = useState(currentAiName);
    const [userName, setUserName] = useState(currentUserName);
    const [voiceId, setVoiceId] = useState(currentVoiceId);
    const [voices, setVoices] = useState<VoiceOption[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch available voices on mount
    useEffect(() => {
        if (isOpen) {
            fetch(`/api/settings?userId=${userId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.availableVoices) {
                        setVoices(data.availableVoices);
                    }
                    if (data.identity?.name) setAiName(data.identity.name);
                    if (data.identity?.voiceId) setVoiceId(data.identity.voiceId);
                    if (data.user?.displayName) setUserName(data.user.displayName);
                })
                .catch(err => {
                    console.error('Failed to fetch settings:', err);
                    setError('設定の読み込みに失敗しました');
                });
        }
    }, [isOpen, userId]);

    // Update local state when props change
    useEffect(() => {
        setAiName(currentAiName);
        setUserName(currentUserName);
        setVoiceId(currentVoiceId);
    }, [currentAiName, currentUserName, currentVoiceId]);

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
                    voiceId: voiceId || undefined,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || '保存に失敗しました');
            }

            onSave({ aiName, userName, voiceId });
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
                        className="bg-gray-900 border border-white/20 rounded-2xl p-6 w-full max-w-md shadow-2xl"
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
                                                {voice.name} - {voice.description}
                                            </option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="女性" className="bg-gray-900">
                                        {voices.filter(v => v.gender === 'female').map(voice => (
                                            <option key={voice.id} value={voice.id} className="bg-gray-900">
                                                {voice.name} - {voice.description}
                                            </option>
                                        ))}
                                    </optgroup>
                                </select>
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
