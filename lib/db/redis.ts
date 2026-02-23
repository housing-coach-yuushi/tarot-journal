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
const USER_ALIAS_PREFIX = `${PREFIX}user-alias:`;
const USER_AI_PREFIX = `${PREFIX}user-ai:`;
const FORCED_USER_ID = (process.env.FORCE_USER_ID || '').trim();

function normalizeId(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const id = raw.trim();
    if (!id || id === 'default') return null;
    return id;
}

export interface AIIdentity {
    name: string;
    personality: string;
    speakingStyle: string;
    emoji: string;
    voiceId?: string;  // TTS voice model ID
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

/**
 * Resolve a possibly-fragmented userId to a canonical userId.
 * - If FORCE_USER_ID is set, always use it (single-user mode).
 * - Otherwise, resolve via Redis alias mapping.
 */
export async function resolveCanonicalUserId(userId: string): Promise<string> {
    const normalized = normalizeId(userId);
    if (!normalized) {
        throw new Error('Invalid userId');
    }

    if (FORCED_USER_ID) {
        return FORCED_USER_ID;
    }

    const alias = await redis.get<string>(`${USER_ALIAS_PREFIX}${normalized}`);
    const resolved = normalizeId(alias);
    return resolved || normalized;
}

export async function setUserIdAlias(sourceUserId: string, canonicalUserId: string): Promise<void> {
    const source = normalizeId(sourceUserId);
    const canonical = normalizeId(canonicalUserId);
    if (!source || !canonical || source === canonical) {
        return;
    }
    await redis.set(`${USER_ALIAS_PREFIX}${source}`, canonical);
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

// Per-user AI Identity operations (user-specific George name/personality)
export async function getUserAIIdentity(userId: string): Promise<AIIdentity | null> {
    return redis.get<AIIdentity>(`${USER_AI_PREFIX}${userId}`);
}

export async function setUserAIIdentity(userId: string, identity: AIIdentity): Promise<void> {
    await redis.set(`${USER_AI_PREFIX}${userId}`, identity);
}

export async function updateUserAIIdentity(userId: string, updates: Partial<AIIdentity>): Promise<AIIdentity | null> {
    const current = await getUserAIIdentity(userId);
    if (!current) return null;

    const updated = {
        ...current,
        ...updates,
        updatedAt: new Date().toISOString(),
    };
    await setUserAIIdentity(userId, updated);
    return updated;
}

export async function getResolvedAIIdentity(userId?: string | null): Promise<AIIdentity | null> {
    if (userId) {
        const userIdentity = await getUserAIIdentity(userId);
        if (userIdentity) return userIdentity;
    }
    return getAIIdentity();
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
        .map((item): ConversationHistory['messages'][number] | null => {
            if (typeof item === 'string') {
                try {
                    return JSON.parse(item) as ConversationHistory['messages'][number];
                } catch {
                    return null;
                }
            }
            if (typeof item === 'object' && item !== null) {
                const candidate = item as { role?: unknown; content?: unknown; timestamp?: unknown };
                if (
                    (candidate.role === 'user' || candidate.role === 'assistant')
                    && typeof candidate.content === 'string'
                ) {
                    return {
                        role: candidate.role,
                        content: candidate.content,
                        timestamp: typeof candidate.timestamp === 'string'
                            ? candidate.timestamp
                            : new Date().toISOString(),
                    };
                }
            }
            return null;
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

export async function deleteUserAIIdentity(userId: string): Promise<void> {
    await redis.del(`${USER_AI_PREFIX}${userId}`);
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
