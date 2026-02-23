import { NextRequest, NextResponse } from 'next/server';
import {
    deleteAIIdentity,
    deleteUserAIIdentity,
    deleteUserProfile,
    clearConversationHistory,
    resolveCanonicalUserId,
} from '@/lib/db/redis';

export async function POST(request: NextRequest) {
    try {
        const { userId: rawUserId = 'default', resetType = 'all' } = await request.json();
        const forcedUserId = (process.env.FORCE_USER_ID || '').trim();
        const normalizedUserId = typeof rawUserId === 'string' && rawUserId.trim() && rawUserId !== 'default'
            ? rawUserId.trim()
            : null;
        const userId = normalizedUserId
            ? await resolveCanonicalUserId(normalizedUserId)
            : (forcedUserId || 'default');

        // resetType: 'all' | 'ai' | 'user' | 'global-ai'
        if (resetType === 'all' || resetType === 'ai') {
            await deleteUserAIIdentity(userId);
            console.log(`User AI identity deleted for ${userId}`);
        }

        if (resetType === 'global-ai') {
            await deleteAIIdentity();
            console.log('Global AI identity deleted');
        }

        if (resetType === 'all' || resetType === 'user') {
            await deleteUserProfile(userId);
            await clearConversationHistory(userId);
            console.log(`User profile and history deleted for ${userId}`);
        }

        return NextResponse.json({
            success: true,
            message: resetType === 'all'
                ? '全てリセットしました。目覚めの儀式から再開します。'
                : resetType === 'ai'
                    ? 'AIのアイデンティティをリセットしました。'
                    : resetType === 'global-ai'
                        ? 'グローバルAIのアイデンティティをリセットしました。'
                    : 'ユーザー情報をリセットしました。',
        });
    } catch (error) {
        console.error('Reset API Error:', error);
        return NextResponse.json(
            { error: `リセットに失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
        );
    }
}
