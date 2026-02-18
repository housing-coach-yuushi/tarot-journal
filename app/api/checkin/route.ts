import { NextRequest, NextResponse } from 'next/server';
import { chatWithClaude } from '@/lib/anthropic/client';
import { getUserProfile, getConversationHistory, resolveCanonicalUserId } from '@/lib/db/redis';

function normalizeUserId(raw: string | null): string | null {
  if (!raw) return null;
  const id = raw.trim();
  if (!id || id === 'default') return null;
  return id;
}

const CHECKIN_PROMPTS = {
  morning: {
    first: [
      'おはようございます\n新しい一日の始まりに、ジャーナルを開きましょう\n心を静かにして、今日の自分に意識を向けて...',
      'おはようございます\n今日はどんな一日にしたいですか？\nゆっくり呼吸を整えて...',
      'おはようございます\n朝の静かな時間に、自分と向き合いましょう\n今の気持ちに意識を向けて...',
      'おはようございます\n新しい朝が来ましたね\n今日の intentions を一緒に見つけましょう...',
    ],
    second: [
      'おはようございます\n今日二回目のジャーナルですね\n今の気分はいかがですか？',
      'おはようございます\n朝の間にもう一度、自分をチェックしましょう\n何か気になることはありますか？',
    ],
  },
  afternoon: {
    first: [
      'こんにちは\n昼休みにジャーナルを開きましょう\n午前中を振り返ってみませんか？',
      'こんにちは\n今日はどんな午前でしたか？\n今の気持ちに意識を向けて...',
      'こんにちは\n一日の半ばで、少し立ち止まってみましょう\n今の状態を確認してみませんか？',
    ],
    second: [
      'こんにちは\n今日二回目のジャーナルですね\n午後の調子はいかがですか？',
      'こんにちは\nまた来てくれましたね\n今一番気になっていることは何ですか？',
    ],
  },
  evening: {
    first: [
      'こんばんは\n一日おつかれさまでした\n今日を振り返るジャーナルの時間です',
      'こんばんは\n夜の静けさの中で、自分と向き合いましょう\n今日はどんな一日でしたか？',
      'こんばんは\n今日という一日を、一緒に振り返ってみませんか？\n心を落ち着かせて...',
    ],
    second: [
      'こんばんは\n今日二回目のジャーナルですね\n夜のチェックインをしましょう',
      'こんばんは\nまた来てくれましたね\n今の気分はいかがですか？',
    ],
  },
  night: {
    first: [
      'おつかれさまでした\n深い夜に、自分と向き合いましょう\n今日一番印象に残っていることは何ですか？',
      'おやすみ前のジャーナルですね\n今日を締めくくる言葉を探してみましょう',
      '静かな夜ですね\n一日を振り返って、心を整えましょう\n明日への準備を...',
    ],
    second: [
      '今日二回目のジャーナルですね\n夜も更けてきました\n今思っていることを話してみませんか？',
      'また来てくれましたね\n静かな夜に、自分の内側に意識を向けて...',
    ],
  },
};

function getTimeOfDay(hour: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUserId = normalizeUserId(searchParams.get('userId'));
    const sessionCount = parseInt(searchParams.get('sessionCount') || '1', 10);
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

    const timeOfDay = getTimeOfDay(hour);
    const dateStr = `${year}年${month}月${day}日`;
    const seasons = ['冬', '冬', '春', '春', '春', '夏', '夏', '夏', '秋', '秋', '秋', '冬'];
    const season = seasons[month - 1];

    // Get appropriate prompts
    const isFirst = sessionCount <= 1;
    const promptsForTime = CHECKIN_PROMPTS[timeOfDay];
    const prompts = isFirst ? promptsForTime.first : promptsForTime.second;
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];

    // If user has a name, try to personalize
    let userName = '';
    if (userId) {
      const userProfile = await getUserProfile(userId).catch(() => null);
      if (userProfile?.displayName) {
        userName = userProfile.displayName;
      }
    }

    // Build personalized prompt with Claude
    const systemPrompt = `あなたはタロットジャーナルアプリのチェックインガイドです。
以下のベースとなるチェックイン文章を、少しアレンジしてください。

ルール:
- ベースの文章の意味を保つ
- 少し変化をつける（言葉選び、リズムなど）
- 温かく、シンプルに
- 2〜3行で構成
- 合計60文字以内

${userName ? `- ユーザーの名前: ${userName}（自然に取り入れる）` : ''}

今日の日付: ${dateStr}
曜日: ${dayOfWeek}
季節: ${season}
セッション回数: 今日${sessionCount}回目`;

    try {
      const result = await chatWithClaude([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `ベースの文章:\n${randomPrompt}\n\nこれを少しアレンジしてください。` },
      ]);

      const lines = result.trim().split('\n').filter(l => l.trim());
      if (lines.length > 0) {
        return NextResponse.json({ lines, sessionCount });
      }
    } catch (e) {
      console.warn('Claude checkin failed, using fallback:', e);
    }

    // Fallback to random prompt
    return NextResponse.json({ 
      lines: randomPrompt.split('\n').filter(l => l.trim()),
      sessionCount 
    });
  } catch (error) {
    console.error('Checkin API error:', error);
    return NextResponse.json({
      lines: ['自分と向き合う時間を始めます', '一緒にジャーナルをつけていきましょう', '心を静かにして...'],
      sessionCount: 1,
    });
  }
}
