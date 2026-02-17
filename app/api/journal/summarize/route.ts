import { NextRequest, NextResponse } from 'next/server';
import { chatWithClaude } from '@/lib/anthropic/client';
import { updateJournal, getTodayDate } from '@/lib/journal/storage';
import { getUserProfile, getAIIdentity, resolveCanonicalUserId } from '@/lib/db/redis';

export async function POST(request: NextRequest) {
    try {
        const { messages, userId: rawUserId } = await request.json();
        const normalizedUserId = (typeof rawUserId === 'string' && rawUserId.trim() && rawUserId !== 'default')
            ? rawUserId.trim()
            : null;

        if (!normalizedUserId) {
            return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
        }
        const userId = await resolveCanonicalUserId(normalizedUserId);

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
        }

        // Fetch names from DB
        const [userProfile, aiIdentity] = await Promise.all([
            getUserProfile(userId),
            getAIIdentity(),
        ]);
        const userName = userProfile?.displayName || 'わたし';
        const aiName = aiIdentity?.name || 'ジョージ';
        const conversationText = messages
            .map((message: { role?: string; content?: string }) => {
                const speaker = message.role === 'assistant' ? aiName : userName;
                return `${speaker}: ${message.content || ''}`;
            })
            .join('\n\n');

        // Prepare prompt for summarization
        const prompt = `あなたは日本語のプロ編集者です。
提供された対話を、タロットジャーナルの記録として「タイトル（15文字以内）」と「内省の要約（200文字程度）」に再構成してください。

# 目的
AIっぽさ（テンプレ感、説明書感、記号過多、過剰な丁寧さ、逃げ文句、抽象語の空回り）を完全に消すこと。

# 厳守ルール
- 内容の捏造や具体化はしない。元の文章にない数字・固有名詞・事例は足さない。
- 「結論から言うと」「以下で解説します」などの前置き宣言は入れない。いきなり本文として自然に書き出す。
- 「一般的に」「状況によります」などの安全クッションは削除する。
- 「重要」「メリット」などの抽象語を避け、動詞中心の具体的表現にする。
- 同じ内容の繰り返しや同義語の連打をやめ、一回で言い切る。
- 文のリズムを均一にせず、短い文と長い文を混ぜる。
- 箇条書きは禁止。一つの物語として読めるように整える。

出力フォーマット:
タイトル: [タイトル]
内容: [再構成された要約文]

対話内容:
${conversationText}`;

        // Fetch names from DB for dynamic labeling if needed
        // (Names are already handled in conversationText preparation)

        const text = await chatWithClaude([{ role: 'user', content: prompt }]);

        // Parse Title and Content
        const titleMatch = text.match(/タイトル:\s*(.+)/);
        const contentMatch = text.match(/内容:\s*(.+)/s);

        const title = titleMatch ? titleMatch[1].trim() : '今日のジャーナル';
        const summary = contentMatch ? contentMatch[1].trim() : text;

        // Update cloud storage (Redis)
        const date = getTodayDate();
        await updateJournal(userId, date, {
            summary: summary,
            // You might want to save the title in metadata or summary
        });

        return NextResponse.json({ title, summary });
    } catch (error) {
        console.error('Summarize error:', error);
        return NextResponse.json({ error: 'Failed to summarize' }, { status: 500 });
    }
}
