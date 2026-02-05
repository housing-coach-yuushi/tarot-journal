import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export async function chatWithClaude(messages: ChatMessage[], model?: string) {
    const selectedModel = model || process.env.CLAUDE_MODEL || 'claude-3-5-haiku-20241022';
    const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
    const otherMessages = messages.filter(m => m.role !== 'system');

    console.log(`[CLAUDE] Using model: ${selectedModel}`);

    const { text } = await generateText({
        model: anthropic(selectedModel),
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: otherMessages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
        })),
    });

    return text;
}
