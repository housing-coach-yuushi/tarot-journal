import { NextRequest, NextResponse } from 'next/server';
import { chatWithClaude } from '@/lib/anthropic/client';
import { updateJournal, getTodayDate } from '@/lib/journal/storage';

export async function POST(request: NextRequest) {
    try {
        const { messages, userId = 'default' } = await request.json();

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
        }

        // Prepare prompt for summarization
        const conversationText = messages
            .map((m: any) => {
                const roleName = m.role === 'assistant' ? 'Assistant' : 'User';
                const content = m.role === 'tarot' ? `[Card Draw: ${m.content}]` : m.content;
                return `${roleName}: ${content}`;
            })
            .join('\n');

        const prompt = `以下の対話内容を、タロットジャーナルの記録として「タイトル（15文字以内）」と「要約（200文字程度）」にまとめてください。
要約は、CAMJAPANの「３つの変化」の視点を含めるようにしてください：
1. **能動的変化（行動）**: 具体的に何をしたか、どう動いたか
2. **転換（思考）**: どんな気づきがあり、どう捉え方が変わったか
3. **変革（在り方）**: 自分の大切にしたい価値観や、どう在りたいかにどう触れたか

出力フォーマット:
タイトル: [タイトル]
内容: [要約内容]

対話内容:
${conversationText}`;

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
