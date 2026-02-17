import { NextRequest, NextResponse } from 'next/server';
import { chatWithClaude } from '@/lib/anthropic/client';
import { getUserProfile, getAIIdentity, resolveCanonicalUserId } from '@/lib/db/redis';

export async function POST(request: NextRequest) {
    try {
        const { messages, userId: rawUserId = 'default' } = await request.json();
        const forcedUserId = (process.env.FORCE_USER_ID || '').trim();
        const normalizedUserId = typeof rawUserId === 'string' && rawUserId.trim() && rawUserId !== 'default'
            ? rawUserId.trim()
            : null;
        const userId = normalizedUserId
            ? await resolveCanonicalUserId(normalizedUserId)
            : (forcedUserId || 'default');

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
        const prompt = `あなたは日本語のプロ編集者です。
提供された対話内容を、読み手が「人が書いた」と感じる自然な日記形式に全面的に書き直してください。

# 目的
AIっぽさ（テンプレ感、説明書感、記号過多、過剰な丁寧さ、逃げ文句、抽象語の空回り）を完全に消すこと。

# 厳守ルール
- ユーザーの言葉や感情をできるだけそのまま残し、削りすぎないこと。
- 内容の捏造や、根拠のない具体化はしない。
- 「結論から言うと」「本記事では」などの前置き宣言は入れない。
- 「一般的に」「状況によります」などの安全クッションは削除する。
- 「重要」「メリット」などの抽象語を避け、動詞中心の具体的表現にする。
- 同じ内容の繰り返しや同義語の連打をやめ、一回で言い切る。
- 文のリズムを均一にせず、短い文と長い文を混ぜる。
- Markdown記法を使わない（太字、見出し、箇条書き記号は禁止）。
- 記号（「」、（）、：、／、→）を最小化し、文脈に溶かすこと。
- タロットカードが出たら、カード名と簡単な意味を文章の中に自然に組み込む。
- 最後に「今日の一言」として、${aiName}からの鋭く、かつ印象的なコメントを一文だけ添える。

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
