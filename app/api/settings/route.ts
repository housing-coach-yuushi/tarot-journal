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
} from '@/lib/db/redis';
import { JAPANESE_VOICES, getVoiceById } from '@/lib/tts/voices';

// GET: Retrieve current settings
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    try {
        const identity = await getAIIdentity();
        const user = userId ? await getUserProfile(userId) : null;

        return NextResponse.json({
            identity: identity ? {
                name: identity.name,
                voiceId: identity.voiceId,
                emoji: identity.emoji,
            } : null,
            user: user ? {
                displayName: user.displayName,
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
        const { userId, aiName, userName, voiceId } = body;

        const updates: Record<string, unknown> = {};

        // Update AI identity
        if (aiName !== undefined || voiceId !== undefined) {
            const aiUpdates: Record<string, string> = {};
            if (aiName) aiUpdates.name = aiName;
            if (voiceId) {
                // Validate voice ID
                const voice = getVoiceById(voiceId);
                if (voice) {
                    aiUpdates.voiceId = voiceId;
                } else {
                    return NextResponse.json(
                        { error: '無効な声IDです' },
                        { status: 400 }
                    );
                }
            }
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
