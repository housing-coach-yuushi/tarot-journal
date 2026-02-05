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

// Ensure URL starts with http/https (only if url is present)
const formattedUrl = url ? (url.startsWith('http') ? url : `https://${url}`) : undefined;

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
    showDebug?: boolean; // Whether to show debug logs in UI
    bgmEnabled?: boolean; // Whether to play background music
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

const HISTORY_MAX = 100;
const HISTORY_TTL_SEC = 60 * 60 * 24 * 90; // 90 days

const historyAppendScript = redis.createScript<number>(`
    redis.call('LPUSH', KEYS[1], ARGV[1])
    redis.call('LTRIM', KEYS[1], 0, tonumber(ARGV[2]))
    return 1
`);

async function ensureHistoryList(userId: string): Promise<string> {
    const key = `${PREFIX}history:${userId}`;
    const type = await redis.type(key);

    if (type === 'string') {
        const legacy = await redis.get<ConversationHistory>(key);
        await redis.del(key);
        if (legacy?.messages?.length) {
            for (const msg of legacy.messages) {
                await redis.lpush(key, JSON.stringify(msg));
            }
            await redis.ltrim(key, 0, HISTORY_MAX - 1);
            await redis.expire(key, HISTORY_TTL_SEC);
        }
    }

    return key;
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

export async function updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    const current = await getUserProfile(userId);
    if (!current) return null;

    const updated = {
        ...current,
        ...updates,
        updatedAt: new Date().toISOString(),
    };
    await setUserProfile(userId, updated);
    return updated;
}

// Conversation History operations
export async function getConversationHistory(userId: string, limit = 50): Promise<ConversationHistory> {
    if (limit <= 0) return { messages: [] };

    const key = await ensureHistoryList(userId);
    const raw = await redis.lrange<string>(key, 0, limit - 1);

    if (!raw || raw.length === 0) return { messages: [] };

    const parsed = raw
        .map(item => {
            try {
                return JSON.parse(item) as ConversationHistory['messages'][number];
            } catch {
                return null;
            }
        })
        .filter(Boolean) as ConversationHistory['messages'];

    // Stored newest-first; return chronological
    return { messages: parsed.reverse() };
}

export async function addToConversationHistory(
    userId: string,
    message: { role: 'user' | 'assistant'; content: string }
): Promise<void> {
    const key = await ensureHistoryList(userId);
    const payload = JSON.stringify({
        ...message,
        timestamp: new Date().toISOString(),
    });

    await historyAppendScript.exec([key], [payload, String(HISTORY_MAX - 1)]);
    await redis.expire(key, HISTORY_TTL_SEC);
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
