import { NextRequest, NextResponse } from 'next/server';
import { getKieApiClient, ChatMessage } from '@/lib/keiapi/client';
import {
    isBootstrapComplete,
    isUserOnboarded,
    getBootstrapSystemPrompt,
    getNewUserSystemPrompt,
    getRegularSystemPrompt,
    saveIdentity,
    saveUser,
    loadIdentity,
    loadUser
} from '@/lib/clawdbot/bootstrap';
import { addToConversationHistory, getConversationHistory } from '@/lib/db/redis';
import { addMessage } from '@/lib/journal/storage';
import { getVoiceIdByName, DEFAULT_VOICE_ID } from '@/lib/tts/voices';

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
        const userOnboarded = await isUserOnboarded(userId);

        let systemPrompt: string;
        if (!isBootstrapped) {
            // AI hasn't been born yet - do full bootstrap
            systemPrompt = getBootstrapSystemPrompt();
        } else if (!userOnboarded) {
            // AI exists but this is a new user - do user onboarding
            systemPrompt = await getNewUserSystemPrompt();
        } else {
            // Both AI and user are set up - normal mode
            systemPrompt = await getRegularSystemPrompt(userId);
        }

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
        let response = await client.chat(messages);

        // Parse identity_data block if present (for AI bootstrap)
        const identityDataMatch = response.match(/```identity_data\n([\s\S]*?)```/);
        if (identityDataMatch) {
            const identityData: { name?: string; creature?: string; vibe?: string; emoji?: string; voiceId?: string } = {};
            const lines = identityDataMatch[1].split('\n');
            for (const line of lines) {
                const [key, ...valueParts] = line.split(':');
                const value = valueParts.join(':').trim();
                if (key.trim() === 'name' && value) {
                    identityData.name = value;
                }
                if (key.trim() === 'creature' && value) {
                    identityData.creature = value;
                }
                if (key.trim() === 'vibe' && value) {
                    identityData.vibe = value;
                }
                if (key.trim() === 'emoji' && value) {
                    identityData.emoji = value;
                }
                if (key.trim() === 'voice' && value) {
                    // Convert voice name to voice ID
                    const voiceId = getVoiceIdByName(value);
                    identityData.voiceId = voiceId || DEFAULT_VOICE_ID;
                }
            }

            // Save identity data if we got a name
            if (identityData.name) {
                await saveIdentity(identityData);
                console.log('Saved AI identity:', identityData);
            }

            // Remove the identity_data block from the response
            response = response.replace(/```identity_data\n[\s\S]*?```/g, '').trim();
        }

        // Parse user_data block if present (for onboarding)
        const userDataMatch = response.match(/```user_data\n([\s\S]*?)```/);
        if (userDataMatch) {
            const userData: { name?: string; callName?: string } = {};
            const lines = userDataMatch[1].split('\n');
            for (const line of lines) {
                const [key, ...valueParts] = line.split(':');
                const value = valueParts.join(':').trim();
                if (key.trim() === 'name' && value) {
                    userData.name = value;
                }
                if (key.trim() === 'callName' && value) {
                    userData.callName = value;
                }
            }

            // Save user data if we got a name
            if (userData.name) {
                await saveUser(userData, userId);
                console.log(`Saved user data for ${userId}:`, userData);
            }

            // Remove the user_data block from the response
            response = response.replace(/```user_data\n[\s\S]*?```/g, '').trim();
        }

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
            userOnboarded: await isUserOnboarded(userId),
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
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId') || 'default';

        const isBootstrapped = await isBootstrapComplete();
        const userOnboarded = await isUserOnboarded(userId);
        const identity = await loadIdentity();
        const user = await loadUser(userId);
        const history = await getConversationHistory(userId, 20);

        return NextResponse.json({
            isBootstrapped,
            userOnboarded,
            identity,
            user,
            history: history.messages,
        });
    } catch (error) {
        console.error('Chat API GET Error:', error);
        return NextResponse.json(
            { error: `Failed to load chat state: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
