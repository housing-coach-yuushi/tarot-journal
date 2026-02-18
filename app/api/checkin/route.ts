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
  - 1行目: 挨拶（時間帯に合わせて）
  - 2行目: ジャーナルへの導入
  - 3行目: チェックイン（意識を内側に向ける誘導）
- 合計で60文字以内に収める
- 毎回違う表現を使う
- 詩的すぎず、シンプルで温かい言葉

コンテキスト:
- 今日の日付: {{date}}
- 時間帯: {{timeOfDay}}
- 曜日: {{dayOfWeek}}
- 季節: {{season}}
- セッション回数: 今日{{sessionCount}}回目
{{userName}}

{{sessionHint}}

出力形式（2〜3行だけを返すこと。余計な説明は不要）`;

function getTimeOfDay(hour: number): string {
  if (hour >= 5 && hour < 12) return '朝';
  if (hour >= 12 && hour < 17) return '昼';
  if (hour >= 17 && hour < 21) return '夕方';
  return '夜';
}

function getSessionHint(count: number): string {
  if (count === 1) return 'ヒント: 初回のジャーナル。新しい一日の始まりを意識した言葉で。';
  if (count === 2) return 'ヒント: 今日2回目のジャーナル。続けていることを肯定しつつ、今の状態をチェックする言葉で。';
  return `ヒント: 今日${count}回目のジャーナル。継続を認めつつ、今の気持ちに寄り添う言葉で。`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUserId = normalizeUserId(searchParams.get('userId'));
    const sessionCount = parseInt(searchParams.get('sessionCount') || '1', 10);
    const userId = rawUserId ? await resolveCanonicalUserId(rawUserId) : null;

    // Use Tokyo timezone (JST)
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

    // Get user name if available
    let userName = '';
    if (userId) {
      const userProfile = await getUserProfile(userId).catch(() => null);
      if (userProfile?.displayName) {
        userName = `- ユーザーの名前: ${userProfile.displayName}`;
      }
    }

    const sessionHint = getSessionHint(sessionCount);

    const prompt = CHECKIN_PROMPT
      .replace('{{date}}', dateStr)
      .replace('{{timeOfDay}}', timeOfDay)
      .replace('{{dayOfWeek}}', dayOfWeek)
      .replace('{{season}}', season)
      .replace('{{sessionCount}}', String(sessionCount))
      .replace('{{userName}}', userName)
      .replace('{{sessionHint}}', sessionHint);

    const result = await chatWithClaude([
      { role: 'system', content: prompt },
      { role: 'user', content: '今のチェックインの言葉をください' },
    ]);

    const lines = result.trim().split('\n').filter(l => l.trim());
    
    if (lines.length === 0) {
      lines.push('自分と向き合う時間を始めます', '一緒にジャーナルをつけていきましょう', '心を静かにして...');
    }

    return NextResponse.json({ lines, sessionCount });
  } catch (error) {
    console.error('Checkin API error:', error);
    return NextResponse.json({
      lines: ['自分と向き合う時間を始めます', '一緒にジャーナルをつけていきましょう', '心を静かにして...'],
      sessionCount: 1,
    });
  }
}
