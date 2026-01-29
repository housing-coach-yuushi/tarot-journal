import { NextRequest, NextResponse } from 'next/server';
import {
    deleteAIIdentity,
    deleteUserProfile,
    clearConversationHistory,
} from '@/lib/db/redis';

export async function POST(request: NextRequest) {
    try {
        const { userId = 'default', resetType = 'all' } = await request.json();

        // resetType: 'all' | 'ai' | 'user'
        if (resetType === 'all' || resetType === 'ai') {
            await deleteAIIdentity();
            console.log('AI identity deleted');
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
