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
    setUserProfile,
    updateUserProfile,
    resolveCanonicalUserId,
    type AIIdentity,
} from '@/lib/db/redis';
import { JAPANESE_VOICES, DEFAULT_VOICE_ID, getVoiceById } from '@/lib/tts/voices';

export const dynamic = 'force-dynamic';

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
        const selectedVoiceId = (rawIdentity?.voiceId && getVoiceById(rawIdentity.voiceId))
            ? rawIdentity.voiceId
            : DEFAULT_VOICE_ID;

        return NextResponse.json({
            identity: rawIdentity ? {
                name: rawIdentity.name,
                voiceId: selectedVoiceId,
                emoji: rawIdentity.emoji,
                creature: rawIdentity.personality,
                vibe: rawIdentity.speakingStyle,
                showDebug: rawIdentity.showDebug,
                bgmEnabled: rawIdentity.bgmEnabled,
            } : null,
            user: user ? {
                displayName: user.displayName,
                focusTheme: user.focusTheme,
                futureWish: user.futureWish,
                nonNegotiables: user.nonNegotiables,
            } : null,
            availableVoices: JAPANESE_VOICES.map(v => ({
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
        const {
            userId: rawUserId,
            aiName,
            userName,
            voiceId,
            showDebug,
            bgmEnabled,
            aiCreature,
            aiVibe,
            focusTheme,
            futureWish,
            nonNegotiables,
        } = body;
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

            const normalizedVoiceId =
                (typeof voiceId === 'string' && getVoiceById(voiceId))
                    ? voiceId
                    : (base?.voiceId && getVoiceById(base.voiceId) ? base.voiceId : DEFAULT_VOICE_ID);

            const next: AIIdentity = {
                name: (typeof aiName === 'string' && aiName.trim()) ? aiName.trim() : (base?.name || 'ジョージ'),
                personality: (typeof aiCreature === 'string' && aiCreature.trim()) ? aiCreature.trim() : (base?.personality || 'ジャーナリング・パートナー'),
                speakingStyle: (typeof aiVibe === 'string' && aiVibe.trim()) ? aiVibe.trim() : (base?.speakingStyle || '落ち着いた、親しみやすい'),
                emoji: base?.emoji || '✍️',
                // Use selected voice when valid; always keep a default fallback to avoid silent TTS.
                voiceId: normalizedVoiceId,
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
                voiceId: updatedIdentity.voiceId || DEFAULT_VOICE_ID,
                showDebug: updatedIdentity.showDebug,
                bgmEnabled: updatedIdentity.bgmEnabled,
            } : null;
        }

        // Update user profile
        const hasUserProfileUpdate =
            userId && (
                userName !== undefined
                || focusTheme !== undefined
                || futureWish !== undefined
                || nonNegotiables !== undefined
            );

        if (hasUserProfileUpdate && userId) {
            const existingUser = await getUserProfile(userId);
            const userUpdates = {
                ...(userName !== undefined ? { displayName: typeof userName === 'string' ? userName : '' } : {}),
                ...(focusTheme !== undefined ? { focusTheme: typeof focusTheme === 'string' ? focusTheme : '' } : {}),
                ...(futureWish !== undefined ? { futureWish: typeof futureWish === 'string' ? futureWish : '' } : {}),
                ...(nonNegotiables !== undefined ? { nonNegotiables: typeof nonNegotiables === 'string' ? nonNegotiables : '' } : {}),
            };

            if (existingUser) {
                const updatedUser = await updateUserProfile(userId, userUpdates);
                updates.user = updatedUser;
            } else {
                const now = new Date().toISOString();
                const createdUser = {
                    userId,
                    displayName: (typeof userName === 'string' ? userName : '').trim(),
                    focusTheme: typeof focusTheme === 'string' ? focusTheme : undefined,
                    futureWish: typeof futureWish === 'string' ? futureWish : undefined,
                    nonNegotiables: typeof nonNegotiables === 'string' ? nonNegotiables : undefined,
                    createdAt: now,
                    updatedAt: now,
                };
                await setUserProfile(userId, createdUser);
                updates.user = createdUser;
            }
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
