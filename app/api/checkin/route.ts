import { NextRequest, NextResponse } from 'next/server';
import { chatWithClaude } from '@/lib/anthropic/client';
import { getUserProfile, getConversationHistory, resolveCanonicalUserId } from '@/lib/db/redis';

function normalizeUserId(raw: string | null): string | null {
  if (!raw) return null;
  const id = raw.trim();
  if (!id || id === 'default') return null;
  return id;
}

const CHECKIN_PROMPT = `あなたはタロットジャーナルアプリのチェックインガイドです。
ユーザーがこれからジャーナルをつけ始めるにあたって、心を落ち着かせ、自分の内面に意識を向けるための短い言葉を生成してください。

ルール:
- 2〜3行で構成する
  - 1行目: 声かけ（挨拶、パーソナルな一言、季節の話題など）
  - 2行目: ジャーナルの目的（これからジャーナルをつけることを自然に伝える）
  - 3行目: チェックイン（意識を内側に向ける誘導。「...」で終わる）
  ※1行目と2行目は1行にまとめてもいい（合計2〜3行）
- 合計で60文字以内に収める
- 毎回違う表現を使う
- 詩的すぎず、シンプルで温かい言葉
- 以下のコンテキスト情報を自然に取り入れること（全部使う必要はない、最も自然なものを1つ2つ選ぶ）
- 季節の行事・イベント・話題を軽く入れてもいい（雑談レベル。例: 節分が近い、桜の季節、年末など）
- ただし重くならないこと。あくまでチェックインの導入

コンテキスト:
- 今日の日付: {{date}}
- 時間帯: {{timeOfDay}}
- 曜日: {{dayOfWeek}}
- 季節: {{season}}
{{userName}}
{{lastSession}}

出力形式（2〜3行だけを返すこと。余計な説明は不要）:

例（久しぶり + 名前がある場合）:
5日ぶりですね、おかえりなさい
今日も一緒にジャーナルをつけていきましょう
ゆっくり、意識を内側へ...

例（朝の場合）:
おはようございます
新しい一日のはじまりに、ジャーナルを開きましょう
心を静かにして...

例（夜の場合）:
一日おつかれさまでした
今日を振り返るジャーナルの時間です
今の気持ちに意識を向けて...

例（季節を取り入れる場合）:
節分が近いですね
心も整えて、ジャーナルを始めましょう
自分の内側に意識を向けて...

例（毎日来てくれる場合）:
今日も来てくれましたね
一緒にジャーナルをつけていきましょう
少し呼吸を整えて...`;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUserId = normalizeUserId(searchParams.get('userId'));
    const userId = rawUserId ? await resolveCanonicalUserId(rawUserId) : null;

    // Use Tokyo timezone (JST) for all date/time calculations
    const now = new Date();
    const parts = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'long',
      hour: 'numeric',
      hour12: false,
    }).formatToParts(now);

    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
    const hour = Number(getPart('hour'));
    const year = getPart('year');
    const month = Number(getPart('month'));
    const day = getPart('day');
    const dayOfWeek = getPart('weekday');

    const timeOfDay = hour >= 5 && hour < 12 ? '朝' : hour >= 12 && hour < 17 ? '昼' : hour >= 17 && hour < 21 ? '夕方' : '夜';
    const greeting =
      timeOfDay === '朝' ? 'おはようございます' :
      timeOfDay === '昼' ? 'こんにちは' :
      timeOfDay === '夕方' ? 'こんばんは' :
      'おつかれさまでした';
    const dateStr = `${year}年${month}月${day}日`;
    const seasons = ['冬', '冬', '春', '春', '春', '夏', '夏', '夏', '秋', '秋', '秋', '冬'];
    const season = seasons[month - 1];

    // Fetch user info and last session in parallel
    const [userProfile, history] = userId ? await Promise.all([
      getUserProfile(userId).catch(() => null),
      getConversationHistory(userId, 1).catch(() => ({ messages: [] })),
    ]) : [null, { messages: [] }];

    // Build context
    const userName = userProfile?.displayName
      ? `- ユーザーの名前: ${userProfile.displayName}`
      : '- ユーザーの名前: まだ不明';

    let lastSession = '- 前回のセッション: 初めての利用';
    if (history.messages.length > 0) {
      const lastTimestamp = history.messages[history.messages.length - 1].timestamp;
      const lastDate = new Date(lastTimestamp);
      const diffMs = now.getTime() - lastDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        lastSession = '- 前回のセッション: 今日（数時間前）';
      } else if (diffDays === 1) {
        lastSession = '- 前回のセッション: 昨日';
      } else {
        lastSession = `- 前回のセッション: ${diffDays}日前`;
      }
    }

    const prompt = CHECKIN_PROMPT
      .replace('{{date}}', dateStr)
      .replace('{{timeOfDay}}', timeOfDay)
      .replace('{{dayOfWeek}}', dayOfWeek)
      .replace('{{season}}', season)
      .replace('{{userName}}', userName)
      .replace('{{lastSession}}', lastSession)
      + `\n\n追加ルール:\n- 1行目は必ず「${greeting}」にする（完全一致）\n- 1行目は挨拶以外の情報を入れない`;

    const result = await chatWithClaude([
      { role: 'system', content: prompt },
      { role: 'user', content: '今のチェックインの言葉をください' },
    ]);

    // Parse 2-3 lines: greeting, journal purpose, checkin
    const lines = result.trim().split('\n').filter(l => l.trim());
    const normalized = lines.map(l => l.trim());
    if (normalized.length === 0) {
      normalized.push(greeting, '一緒にジャーナルをつけていきましょう', '心を静かにして...');
    }
    if (normalized[0] !== greeting) {
      normalized[0] = greeting;
    }
    const allLines = normalized;

    return NextResponse.json({ lines: allLines });
  } catch (error) {
    console.error('Checkin API error:', error);
    return NextResponse.json({
      lines: ['自分と向き合う時間を始めます', '一緒にジャーナルをつけていきましょう', '心を静かにして...'],
    });
  }
}
