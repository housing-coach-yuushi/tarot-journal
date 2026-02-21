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
        const prompt = `# 役割
あなたは日本語のプロ編集者です。下の「元の文章」はAIが書いた下書きです。意味と事実関係は変えずに、読み手が「人が書いた」と感じる自然な日本語に全面的に書き直してください。

# 目的
AIっぽさ（テンプレ感、説明書感、記号過多、過剰な丁寧さ、逃げ文句、抽象語の空回り）を完全に消すこと。

# 厳守ルール（内容）
- 内容の捏造や、根拠のない具体化はしない。元の文章にない数字・固有名詞・事例は足さない。
- 曖昧な箇所は曖昧なままにする。ただし文章として読みやすく整える。
- 読者への質問や確認はしない（追質問禁止）。
- 「結論から言うと」「本記事では」「以下で解説します」などの前置き宣言は入れない。いきなり本文として自然に書き出す。
- 「一般的に」「多くの場合」「状況によって異なります」「一概には言えませんが」など、情報を増やさない安全クッションは原則削除する。必要なら最小限の注意書きに圧縮する。
- 「重要」「効果的」「最適」「本質」「メリット」などの抽象語だけで押し切らない。元文の範囲で「何がどうなるか」が伝わるよう、動詞中心の具体的表現に置き換える。
- 同義語の言い換え連打（例：重要・大切・欠かせない）はやめ、1回で言い切る。
- 「まとめると」「要するに」「総じて」などの抽象まとめの繰り返しや、同内容の再掲は削る。
- 文のリズムを均一にしない。短い文と長い文を混ぜ、同じ型（断定→理由、結論→補足）の連続を避ける。接続詞は必要最小限にする。
- 書き手の立場を漂わせない。一人称を出すなら一貫させ、「私／筆者／私たち」を混ぜない。

# 厳守ルール（記号・表記）
- Markdown記法を使わない（太字、見出し、箇条書き記号、装飾はすべて禁止）。
- 「」を多用しない。定義っぽい括りや強調のためのカギ括弧は削り、文脈に溶かす。引用や固有の呼称に必要な場合だけ最小限に使う。
- ()を多用しない。補足を括弧に逃がさず、必要なら本文の一文として自然に組み込む。
- コロン「：」は原則使わない。使う場合でも「： 」のように直後へ半角スペースを入れない。
- スラッシュ（／）で概念を並列しない。矢印（→）や疑似コード風の表記も避け、文章として書く。
- 締めの定型句（「参考になれば幸いです」「まずは小さく始めましょう」など）を入れない。

# 出力形式
- 書き換え後の文章だけを出力する（解説・前置き・注意書き・チェックリストは出さない）。
- タイトル（15文字以内）と本文（200文字程度）を出力。

出力フォーマット:
タイトル: [タイトル]
内容: [再構成された要約文]

元の文章:
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
