import { NextRequest, NextResponse } from 'next/server';
import { chatWithClaude } from '@/lib/anthropic/client';
import { getUserProfile, getAIIdentity } from '@/lib/db/redis';

export async function POST(request: NextRequest) {
    try {
        const { messages, userId = 'default' } = await request.json();

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

        // Prepare conversation text
        const conversationText = messages
            .map((m: any) => {
                if (m.role === 'tarot' && m.card) {
                    return `[タロット🎴] ${m.card.card?.name || 'カード'} - ${m.content}`;
                }
                const roleName = m.role === 'assistant' ? aiName : userName;
                return `${roleName}: ${m.content}`;
            })
            .join('\n');

        // Prompt for share-friendly formatting (preserving user's voice)
        const prompt = `あなたは個人的なジャーナル記録を整理するエディターです。
以下の対話を、iPhoneのジャーナルアプリに保存するような「親しみやすい日記形式」に整えてください。

重要なルール：
- ユーザーの言葉や感情をできるだけそのまま残してください（要約しすぎない）
- 読みやすい段落に整理するだけで、内容を省略しすぎないこと
- 箇条書きではなく、自然な文章で
- タロットカードが出たら、カード名と簡単な意味も含めてください
- 最後に「今日の一言」として、${aiName}からの印象的なアドバイスを1行だけ入れてください
- 日付は入れないでください（ジャーナルアプリが自動で入れます）

出力フォーマット:
タイトル: [10文字以内のタイトル]
本文:
[整理された日記本文]

---
今日の一言: [${aiName}からの印象的なコメント]

対話内容:
${conversationText}`;

        const text = await chatWithClaude([{ role: 'user', content: prompt }]);

        // Parse the output
        const titleMatch = text.match(/タイトル:\s*(.+)/);
        const bodyMatch = text.match(/本文:\s*([\s\S]*?)(?=---)/);
        const quoteMatch = text.match(/今日の一言:\s*(.+)/);

        const title = titleMatch ? titleMatch[1].trim() : '今日のジャーナル';
        const body = bodyMatch ? bodyMatch[1].trim() : text;
        const quote = quoteMatch ? quoteMatch[1].trim() : '';

        // Format the final share text
        const shareText = `${body}${quote ? `\n\n💬 ${quote}` : ''}`;

        return NextResponse.json({ title, text: shareText });
    } catch (error) {
        console.error('Format for share error:', error);
        return NextResponse.json({ error: 'Failed to format for sharing' }, { status: 500 });
    }
}
