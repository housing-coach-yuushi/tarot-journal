'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, Send } from 'lucide-react';

interface Message {
    id: string;
    role: 'user' | 'george';
    content: string;
    timestamp: Date;
}

interface ChatPanelProps {
    messages: Message[];
    onSendMessage: (message: string) => void;
    isOpen: boolean;
    onToggle: () => void;
}

export default function ChatPanel({ messages, onSendMessage, isOpen, onToggle }: ChatPanelProps) {
    const [input, setInput] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onSendMessage(input.trim());
            setInput('');
        }
    };

    return (
        <>
            {/* Toggle Button */}
            <motion.button
                onClick={onToggle}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/80 flex items-center gap-2 hover:bg-white/20 transition-colors"
                whileTap={{ scale: 0.95 }}
            >
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <ChevronUp size={20} />
                </motion.div>
                <span className="text-sm font-medium">チャット履歴</span>
            </motion.button>

            {/* Chat Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-x-0 bottom-0 z-40 h-[70vh] bg-gradient-to-t from-black via-gray-900/95 to-gray-900/90 backdrop-blur-xl rounded-t-3xl border-t border-white/10"
                    >
                        {/* Handle */}
                        <div className="flex justify-center py-3">
                            <div className="w-12 h-1 rounded-full bg-white/30" />
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-4 pb-24 h-[calc(100%-8rem)]">
                            {messages.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-white/40">
                                    <p>ジョージとの会話がここに表示されます</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {messages.map((msg) => (
                                        <motion.div
                                            key={msg.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[80%] px-4 py-3 rounded-2xl ${msg.role === 'user'
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-white/10 text-white/90'
                                                    }`}
                                            >
                                                <p className="text-sm">{msg.content}</p>
                                                <p className="text-[10px] mt-1 opacity-50">
                                                    {msg.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <form
                            onSubmit={handleSubmit}
                            className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black to-transparent"
                        >
                            <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 border border-white/20">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="メッセージを入力..."
                                    className="flex-1 bg-transparent text-white placeholder-white/40 outline-none text-sm"
                                />
                                <motion.button
                                    type="submit"
                                    whileTap={{ scale: 0.9 }}
                                    className="p-2 rounded-full bg-indigo-600 text-white disabled:opacity-50"
                                    disabled={!input.trim()}
                                >
                                    <Send size={18} />
                                </motion.button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
