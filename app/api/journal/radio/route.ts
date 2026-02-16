import { NextRequest, NextResponse } from 'next/server';
import { redis, getUserProfile } from '@/lib/db/redis';
import { getJournalsFromPastDays } from '@/lib/journal/storage';
import { generateWeeklyRadioScript } from '@/lib/journal/radio_script_generator';
import { getKieApiClient } from '@/lib/keiapi/client';

const CACHE_PREFIX = 'tarot-journal:radio-cache:';
const RADIO_CACHE_TTL_SEC = 60 * 60 * 24 * 3; // 3 days

export async function POST(req: NextRequest) {
    try {
        const { userId, userName: providedName } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: 'UserId is required' }, { status: 400 });
        }

        // Fetch real user name from profile if available
        const profile = await getUserProfile(userId);
        const userName = profile?.displayName || providedName || 'お客様';

        // 1. Fetch journal entries from the past 7 days
        const journals = await getJournalsFromPastDays(userId, 7);
        if (journals.length === 0) {
            return NextResponse.json({ error: 'ジャーナルの履歴がありません。まずは数日間、日記をつけてみてください。' }, { status: 404 });
        }

        // 2. Calculate Date Range
        const startDate = journals.length > 0 ? journals[journals.length - 1].date : ''; // Earliest journal
        const endDate = journals.length > 0 ? journals[0].date : ''; // Latest journal

        // 3. Check Cache
        const journalIds = journals.map(j => j.id).sort().join(',');
        const cacheKey = `${CACHE_PREFIX}${userId}`;
        const cached = await redis.get<{ script: any, audioUrl: string, coverImageUrl?: string, journalIds: string, startDate: string, endDate: string }>(cacheKey);

        if (cached && cached.journalIds === journalIds) {
            let coverImageUrl = cached.coverImageUrl || null;
            if (!coverImageUrl) {
                try {
                    const client = getKieApiClient();
                    coverImageUrl = await client.generateWeeklyRadioCover(
                        cached.script?.title || "Weekly George's Radio",
                        cached.script?.subtitle || 'Weekly Focus Session',
                        userName
                    );
                    await redis.set(cacheKey, { ...cached, coverImageUrl });
                    await redis.expire(cacheKey, RADIO_CACHE_TTL_SEC);
                } catch (err) {
                    console.warn('[radio] cached cover generation failed:', err);
                }
            }
            return NextResponse.json({
                success: true,
                title: cached.script.title,
                subtitle: cached.script.subtitle,
                script: cached.script.lines,
                audioUrl: cached.audioUrl,
                coverImageUrl: coverImageUrl,
                startDate: cached.startDate || startDate,
                endDate: cached.endDate || endDate,
                isNew: false,
            });
        }

        // 4. Generate Radio Script
        const script = await generateWeeklyRadioScript(userId, userName || 'お客様', journals);

        // 5. Generate Audio and Radio Cover via Kie AI
        const client = getKieApiClient();
        const [audioUrl, coverImageUrl] = await Promise.all([
            client.generateDialogue(script.lines),
            client.generateWeeklyRadioCover(script.title, script.subtitle, userName).catch((err) => {
                console.warn('[radio] cover generation failed:', err);
                return null;
            }),
        ]);

        // 6. Save to Cache
        await redis.set(cacheKey, { script, audioUrl, coverImageUrl, journalIds, startDate, endDate });
        await redis.expire(cacheKey, RADIO_CACHE_TTL_SEC);

        return NextResponse.json({
            success: true,
            title: script.title,
            subtitle: script.subtitle,
            script: script.lines,
            audioUrl: audioUrl,
            coverImageUrl: coverImageUrl || null,
            startDate,
            endDate,
            isNew: true,
        });
    } catch (error: any) {
        console.error('Radio Generation Error:', error);
        return NextResponse.json({
            error: error.message || 'ラジオの生成に失敗しました。'
        }, { status: 500 });
    }
}
