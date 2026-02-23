/**
 * Settings API Endpoint
 * GET: Retrieve current AI identity and user profile
 * POST: Update settings (AI name, user name, voice)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    getAIIdentity,
    setAIIdentity,
    getUserAIIdentity,
    setUserAIIdentity,
    getResolvedAIIdentity,
    getUserProfile,
    updateUserProfile,
    resolveCanonicalUserId,
    type AIIdentity,
} from '@/lib/db/redis';
import { JAPANESE_VOICES, DEFAULT_VOICE_ID, getVoiceById } from '@/lib/tts/voices';

// GET: Retrieve current settings
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const rawUserId = searchParams.get('userId');
    const forcedUserId = (process.env.FORCE_USER_ID || '').trim();
    const normalizedUserId = rawUserId && rawUserId.trim() && rawUserId !== 'default'
        ? rawUserId.trim()
        : null;
    const userId = normalizedUserId
        ? await resolveCanonicalUserId(normalizedUserId)
        : (forcedUserId || null);

    try {
        const rawIdentity = await getResolvedAIIdentity(userId || undefined);
        const user = userId ? await getUserProfile(userId) : null;
        const fixedVoice = getVoiceById(DEFAULT_VOICE_ID);

        return NextResponse.json({
            identity: rawIdentity ? {
                name: rawIdentity.name,
                voiceId: DEFAULT_VOICE_ID,
                emoji: rawIdentity.emoji,
                creature: rawIdentity.personality,
                vibe: rawIdentity.speakingStyle,
                showDebug: rawIdentity.showDebug,
                bgmEnabled: rawIdentity.bgmEnabled,
            } : null,
            user: user ? {
                displayName: user.displayName,
            } : null,
            availableVoices: (fixedVoice ? [fixedVoice] : JAPANESE_VOICES).map(v => ({
                id: v.id,
                name: v.name,
                label: v.label,
                gender: v.gender,
                description: v.description,
            })),
        });
    } catch (error) {
        console.error('Settings GET error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch settings' },
            { status: 500 }
        );
    }
}

// POST: Update settings
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId: rawUserId, aiName, userName, voiceId, showDebug, bgmEnabled, aiCreature, aiVibe } = body;
        const forcedUserId = (process.env.FORCE_USER_ID || '').trim();
        const normalizedUserId = typeof rawUserId === 'string' && rawUserId.trim() && rawUserId !== 'default'
            ? rawUserId.trim()
            : null;
        const userId = normalizedUserId
            ? await resolveCanonicalUserId(normalizedUserId)
            : (forcedUserId || null);

        const updates: Record<string, unknown> = {};

        // Update AI identity
        if (aiName !== undefined || voiceId !== undefined || showDebug !== undefined || bgmEnabled !== undefined || aiCreature !== undefined || aiVibe !== undefined) {
            const now = new Date().toISOString();
            const existingUserIdentity = userId ? await getUserAIIdentity(userId) : null;
            const existingGlobalIdentity = await getAIIdentity();
            const base = existingUserIdentity || existingGlobalIdentity;

            const next: AIIdentity = {
                name: (typeof aiName === 'string' && aiName.trim()) ? aiName.trim() : (base?.name || 'ジョージ'),
                personality: (typeof aiCreature === 'string' && aiCreature.trim()) ? aiCreature.trim() : (base?.personality || 'ジャーナリング・パートナー'),
                speakingStyle: (typeof aiVibe === 'string' && aiVibe.trim()) ? aiVibe.trim() : (base?.speakingStyle || '落ち着いた、親しみやすい'),
                emoji: base?.emoji || '✍️',
                // Stability-first: keep conversation voice fixed regardless of UI input.
                voiceId: DEFAULT_VOICE_ID,
                showDebug: showDebug ?? base?.showDebug ?? false,
                bgmEnabled: bgmEnabled ?? base?.bgmEnabled ?? false,
                createdAt: base?.createdAt || now,
                updatedAt: now,
            };

            if (userId) {
                await setUserAIIdentity(userId, next);
            } else {
                await setAIIdentity(next);
            }

            const updatedIdentity = await getResolvedAIIdentity(userId || undefined);
            updates.identity = updatedIdentity ? {
                name: updatedIdentity.name,
                creature: updatedIdentity.personality,
                vibe: updatedIdentity.speakingStyle,
                emoji: updatedIdentity.emoji,
                voiceId: DEFAULT_VOICE_ID,
                showDebug: updatedIdentity.showDebug,
                bgmEnabled: updatedIdentity.bgmEnabled,
            } : null;
        }

        // Update user profile
        if (userName !== undefined && userId) {
            const updatedUser = await updateUserProfile(userId, { displayName: userName });
            updates.user = updatedUser;
        }

        return NextResponse.json({
            success: true,
            updates,
        });
    } catch (error) {
        console.error('Settings POST error:', error);
        return NextResponse.json(
            { error: 'Failed to update settings', details: error instanceof Error ? error.message : 'Unknown' },
            { status: 500 }
        );
    }
}
