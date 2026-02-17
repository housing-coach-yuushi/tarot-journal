/**
 * Radio Script Generator - Aggregate weekly journals into a radio-style discussion
 */

import { JournalEntry, JournalMessage } from './storage';
import { chatWithClaude } from '../anthropic/client';

export interface RadioSpeaker {
    name: string;
    description: string;
    voiceId: string;
}

export const RADIO_PERSONALITIES: Record<string, RadioSpeaker> = {
    George: {
        name: 'George',
        description: '深夜の隠合メンバー制バー「George\'s Bar」のマスター。落ち着いた低音で、洞察力に満ちた渋い男性。哲学的で、時に沈黙を挟みながら言葉を選ぶ。千葉県出身で、たまに方言が出る。',
        voiceId: 'aura-2-fujin-ja',
    },
    Aria: {
        name: 'Aria',
        description: '関西弁を話す明るいラジオDJ。ジョージのバーの常連で、リスナーの視点を代弁する。エネルギッシュで聞き上手な女性。「せやかて」「ほんまに」など関西弁を交えながら、温かく親しみやすいトーンで話す。たまにツッコミを入れる。',
        voiceId: 'aura-2-izanami-ja',
    }
};

export interface RadioLine {
    speaker: string;
    text: string;
}

export interface RadioScript {
    title: string;
    subtitle: string;
    lines: RadioLine[];
}

/**
 * Generate a radio script from weekly journals
 */
export async function generateWeeklyRadioScript(
    userId: string,
    userName: string,
    journals: JournalEntry[]
): Promise<RadioScript> {
    // Sort journals by date ascending (oldest first) for the radio flow
    const sortedJournals = [...journals].sort((a, b) => a.date.localeCompare(b.date));

    // Summarize the contents
    const weekSummary = sortedJournals.map(j => {
        return `【${j.date}】
${j.summary || '内容なし'}
${j.messages.filter(m => m.role === 'user').map(m => `- ${m.content}`).join('\n')}
`;
    }).join('\n\n');

    const systemPrompt = `あなたはラジオ番組「ウィークリー・ジョージズラジオ」の放送作家兼AIコーチです。
ジョージ（千葉出身の落ち着いたコーチ）とアリア（関西弁を話す明るいアシスタント）の対話形式で、ユーザーの1週間を振り返るスクリプトをJSONで作成してください。

キャラクター設定：
- ジョージ：深夜のバーのマスター。哲学的で、沈黙を挟みながら言葉を選ぶ。千葉県出身で、たまに方言が出る。励ます時は「……」を挟んでから語る。
- アリア：関西弁を話すラジオDJ。「せやかて」「ほんまに」「〜やん」「〜やで」などを使う。明るく、ツッコミ役。リスナーの視点を代弁する。

構成：
1. オープニング：アリアがタイトルコール。ジョージが今週の雰囲気を一言。
2. 本編：提供されたジャーナルデータ（日付・内容）を1つずつ丁寧に取り上げ、アリアが関西弁で紹介し、ジョージがコーチとして深い洞察や励ましを送る。
   *日付ごとの具体的な出来事や感情に必ず触れてください。*
   *アリアは明るく、ジョージは落ち着いた口調で。*
3. エンディング：アリアが来週への前向きなメッセージ、ジョージが静かに見守る言葉。

制約：
- 全体で30行〜50行程度の、読み応えのある充実した内容にすること。
- アリアは必ず関西弁で話すこと。
- ジョージは時々「……」を使って沈黙を表現すること。
- 出力は以下のJSON形式のみとし、Markdown装飾（\`\`\`json等）は含めないこと。

{
  "title": "ウィークリー・ジョージズラジオ：${userName}さんの1週間",
  "subtitle": "今週の足跡",
  "lines": [
    {"speaker": "Aria", "text": "こんばんは〜！今夜も始まりました、ウィークリー・ジョージズラジオ！"},
    {"speaker": "George", "text": "……ああ。いらっしゃい。今夜は……${userName}の歩みをじっくり紐解いていこうか。"},
    {"speaker": "Aria", "text": "せやせや！まずは〇曜日、...ということがあったんやて？"},
    {"speaker": "George", "text": "……ふむ。その時の君の決断は、非常に勇気あるものだったと思うよ。"}
  ]
}`;

    const userPrompt = `ターゲットユーザー：${userName}さん
ジャーナルデータ：
${weekSummary}

上記データに基づき、${userName}さんの心に深く残る、具体的で温かいコーチングラジオ台本を作成してください。`;

    const response = await chatWithClaude([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ]);

    try {
        // Extract JSON (handle potential wrapper text)
        const start = response.indexOf('{');
        const end = response.lastIndexOf('}');

        if (start === -1 || end === -1) {
            console.error('Raw response from AI:', response);
            throw new Error('Failed to find JSON in response');
        }

        const jsonStr = response.substring(start, end + 1);
        return JSON.parse(jsonStr) as RadioScript;
    } catch (error) {
        console.error('Failed to parse radio script. Using fallback. Raw response:', response);

        // Manual Fallback Script (Longer & Specific)
        return {
            title: `ウィークリー・ジョージズラジオ：${userName}さんの1週間`,
            subtitle: `${new Date().toLocaleDateString('ja-JP')}号 - 今週の足跡`,
            lines: [
                { speaker: "Aria", text: `こんばんは〜！今夜も始まりました、ウィークリー・ジョージズラジオ！パーソナリティのアリアやで！` },
                { speaker: "George", text: "……ああ。いらっしゃい。今夜は少し、これまでとは違う特別な夜になりそうだ。……君の1週間、じっくり振り返ってみようか。" },
                { speaker: "Aria", text: `せやせや！今週の${userName}さん、${journals.length}件もジャーナルつけてはったんやて？ほんまに偉いわ〜！` },
                { speaker: "George", text: "ふむ。記録の数だけ、君の心が動いた証拠だ。……たとえ言葉にならない日があったとしても、それは後退じゃない。新しい自分へと羽化するための、静かな時間なんだよ。" },
                { speaker: "Aria", text: "ジョージさん、ほんまええこと言うなぁ。月曜日から今日まで、一歩一歩進んできた${userName}さんに、最後にメッセージお願いします！" },
                { speaker: "George", text: "……自分を信じること。それが、暗闇の中で最も強い光になる。${userName}、君なら大丈夫だ。来週も、自分のペースで歩んでいこう。……私はいつでもここで、君の帰りを待っているよ。" },
                { speaker: "Aria", text: `来週も、${userName}さんらしい1週間になりますように！お相手はメインコーチのジョージと、アシスタントのアリアでした。また来週〜！` }
            ]
        };
    }
}
