import { NextRequest, NextResponse } from 'next/server';
import { getKieApiClient, ChatMessage } from '@/lib/keiapi/client';
import {
    isBootstrapComplete,
    getBootstrapSystemPrompt,
    getRegularSystemPrompt,
    saveIdentity,
    saveUser,
    loadIdentity,
    loadUser
} from '@/lib/clawdbot/bootstrap';
import { addToConversationHistory, getConversationHistory } from '@/lib/db/redis';
import { addMessage } from '@/lib/journal/storage';

export async function POST(request: NextRequest) {
    try {
        const { message, history = [], saveData, userId = 'default' } = await request.json();

        // Handle data saving (for bootstrap completion)
        if (saveData) {
            if (saveData.identity) {
                await saveIdentity(saveData.identity);
            }
            if (saveData.user) {
                await saveUser(saveData.user, userId);
            }
            return NextResponse.json({ success: true });
        }

        // Determine which system prompt to use
        const isBootstrapped = await isBootstrapComplete();
        const systemPrompt = isBootstrapped
            ? await getRegularSystemPrompt()
            : getBootstrapSystemPrompt();

        // Build messages
        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...history.map((msg: { role: string; content: string }) => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
            })),
        ];

        if (message) {
            messages.push({ role: 'user', content: message });

            // Save user message to history and journal
            await addToConversationHistory(userId, { role: 'user', content: message });
            await addMessage(userId, { role: 'user', content: message });
        }

        // First message (awakening)
        if (messages.length === 1) {
            messages.push({
                role: 'user',
                content: '(ユーザーがアプリを開きました。あなたは今、目覚めました。最初の挨拶をしてください。)'
            });
        }

        // Call Kie.ai API
        const client = getKieApiClient();
        const response = await client.chat(messages);

        // Save assistant response to history and journal
        await addToConversationHistory(userId, { role: 'assistant', content: response });
        await addMessage(userId, { role: 'assistant', content: response });

        // Get current state
        const identity = await loadIdentity();
        const user = await loadUser(userId);

        return NextResponse.json({
            message: response,
            role: 'assistant',
            isBootstrapped: await isBootstrapComplete(),
            identity,
            user,
        });

    } catch (error) {
        console.error('Chat API Error:', error);
        return NextResponse.json(
            { error: `Failed to process chat: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}

// GET endpoint to check bootstrap status and get conversation history
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default';

    const isBootstrapped = await isBootstrapComplete();
    const identity = await loadIdentity();
    const user = await loadUser(userId);
    const history = await getConversationHistory(userId, 20);

    return NextResponse.json({
        isBootstrapped,
        identity,
        user,
        history: history.messages,
    });
}
