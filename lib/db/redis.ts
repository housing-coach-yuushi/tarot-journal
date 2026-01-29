/**
 * Upstash Redis Client
 * Shared database for storing AI identity and user data
 */

import { Redis } from '@upstash/redis';

// Initialize Redis client
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
    console.error('Redis environment variables missing:', { url: !!url, token: !!token });
}

// Ensure URL starts with http/https
const formattedUrl = url?.startsWith('http') ? url : `https://${url}`;

const redis = new Redis({
    url: formattedUrl || 'https://unexpected-missing-url', // Fallback to avoid immediate crash on init, requests will still fail
    token: token || 'missing-token',
});

// Key prefixes for this app
const PREFIX = 'tarot-journal:';

export interface AIIdentity {
    name: string;
    personality: string;
    speakingStyle: string;
    emoji: string;
    voiceId?: string;  // ElevenLabs voice ID
    createdAt: string;
    updatedAt: string;
}

export interface UserProfile {
    userId: string;
    displayName: string;
    createdAt: string;
    updatedAt: string;
}

export interface ConversationHistory {
    messages: Array<{
        role: 'user' | 'assistant';
        content: string;
        timestamp: string;
    }>;
}

// AI Identity operations
export async function getAIIdentity(): Promise<AIIdentity | null> {
    return redis.get<AIIdentity>(`${PREFIX}ai-identity`);
}

export async function setAIIdentity(identity: AIIdentity): Promise<void> {
    await redis.set(`${PREFIX}ai-identity`, identity);
}

export async function updateAIIdentity(updates: Partial<AIIdentity>): Promise<AIIdentity | null> {
    const current = await getAIIdentity();
    if (!current) return null;

    const updated = {
        ...current,
        ...updates,
        updatedAt: new Date().toISOString(),
    };
    await setAIIdentity(updated);
    return updated;
}

// User Profile operations
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    return redis.get<UserProfile>(`${PREFIX}user:${userId}`);
}

export async function setUserProfile(userId: string, profile: UserProfile): Promise<void> {
    await redis.set(`${PREFIX}user:${userId}`, profile);
}

// Conversation History operations
export async function getConversationHistory(userId: string, limit = 50): Promise<ConversationHistory> {
    const history = await redis.get<ConversationHistory>(`${PREFIX}history:${userId}`);
    if (!history) return { messages: [] };

    // Return only the last N messages
    return {
        messages: history.messages.slice(-limit),
    };
}

export async function addToConversationHistory(
    userId: string,
    message: { role: 'user' | 'assistant'; content: string }
): Promise<void> {
    const history = await getConversationHistory(userId, 100);

    history.messages.push({
        ...message,
        timestamp: new Date().toISOString(),
    });

    // Keep only last 100 messages
    if (history.messages.length > 100) {
        history.messages = history.messages.slice(-100);
    }

    await redis.set(`${PREFIX}history:${userId}`, history);
}

export async function clearConversationHistory(userId: string): Promise<void> {
    await redis.del(`${PREFIX}history:${userId}`);
}

// Delete AI identity (for reset)
export async function deleteAIIdentity(): Promise<void> {
    await redis.del(`${PREFIX}ai-identity`);
}

// Delete user profile (for reset)
export async function deleteUserProfile(userId: string): Promise<void> {
    await redis.del(`${PREFIX}user:${userId}`);
}

// Bootstrap status (AI identity)
export async function isBootstrapComplete(): Promise<boolean> {
    const identity = await getAIIdentity();
    return !!(identity?.name && identity?.personality && identity?.speakingStyle && identity?.emoji);
}

// Check if user has completed their onboarding
export async function isUserOnboarded(userId: string): Promise<boolean> {
    const user = await getUserProfile(userId);
    return !!(user?.displayName);
}

export { redis };
