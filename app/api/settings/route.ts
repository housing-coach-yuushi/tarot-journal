/**
 * Settings API Endpoint
 * GET: Retrieve current AI identity and user profile
 * POST: Update settings (AI name, user name, voice)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    getAIIdentity,
    updateAIIdentity,
    getUserProfile,
    updateUserProfile,
    resolveCanonicalUserId,
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
        const identity = await getAIIdentity();
        const user = userId ? await getUserProfile(userId) : null;
        const fixedVoice = getVoiceById(DEFAULT_VOICE_ID);

        return NextResponse.json({
            identity: identity ? {
                name: identity.name,
                voiceId: DEFAULT_VOICE_ID,
                emoji: identity.emoji,
                showDebug: identity.showDebug,
                bgmEnabled: identity.bgmEnabled,
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
        const { userId: rawUserId, aiName, userName, voiceId, showDebug, bgmEnabled } = body;
        const forcedUserId = (process.env.FORCE_USER_ID || '').trim();
        const normalizedUserId = typeof rawUserId === 'string' && rawUserId.trim() && rawUserId !== 'default'
            ? rawUserId.trim()
            : null;
        const userId = normalizedUserId
            ? await resolveCanonicalUserId(normalizedUserId)
            : (forcedUserId || null);

        const updates: Record<string, unknown> = {};

        // Update AI identity
        if (aiName !== undefined || voiceId !== undefined || showDebug !== undefined || bgmEnabled !== undefined) {
            const aiUpdates: Record<string, unknown> = {};
            if (aiName) aiUpdates.name = aiName;
            if (voiceId !== undefined) {
                // Stability-first: keep conversation voice fixed regardless of UI input.
                aiUpdates.voiceId = DEFAULT_VOICE_ID;
            }
            if (showDebug !== undefined) aiUpdates.showDebug = showDebug;
            if (bgmEnabled !== undefined) aiUpdates.bgmEnabled = bgmEnabled;

            if (Object.keys(aiUpdates).length > 0) {
                const updatedIdentity = await updateAIIdentity(aiUpdates);
                updates.identity = updatedIdentity;
            }
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
