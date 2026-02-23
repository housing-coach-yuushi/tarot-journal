import { NextRequest, NextResponse } from 'next/server';
import { redis, getUserProfile, resolveCanonicalUserId } from '@/lib/db/redis';
import { getJournalsFromPastDays } from '@/lib/journal/storage';
import { generateWeeklyRadioScript } from '@/lib/journal/radio_script_generator';
import { getKieApiClient } from '@/lib/keiapi/client';

const CACHE_PREFIX = 'tarot-journal:radio-cache:';
const RADIO_CACHE_TTL_SEC = 60 * 60 * 24 * 3; // 3 days
const DEFAULT_COVER_IMAGE_URL = '/icon-options/george_illustrative.png';
const RADIO_COVER_ENABLED = (process.env.KEIAPI_RADIO_COVER_ENABLED || '1').trim() !== '0';

type RadioLine = { speaker: string; text: string };
type CachedRadio = {
    script: { title: string; subtitle?: string; lines: RadioLine[] };
    audioUrl: string;
    coverImageUrl?: string;
    journalIds: string;
    startDate: string;
    endDate: string;
};

function normalizeScriptLines(input: unknown): RadioLine[] {
    if (!Array.isArray(input)) return [];
    return input
        .map((line) => {
            if (!line || typeof line !== 'object') return null;
            const speaker = typeof (line as { speaker?: unknown }).speaker === 'string'
                ? (line as { speaker: string }).speaker.trim()
                : '';
            const text = typeof (line as { text?: unknown }).text === 'string'
                ? (line as { text: string }).text.trim()
                : '';
            if (!speaker || !text) return null;
            return { speaker, text };
        })
        .filter((line): line is RadioLine => !!line);
}

function buildRadioCoverPrompt(params: {
    title: string;
    subtitle?: string;
    userName?: string;
    scriptLines: RadioLine[];
}): string {
    const topics = params.scriptLines
        .slice(0, 6)
        .map((line) => line.text.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(' / ')
        .slice(0, 400);

    return [
        'Premium square podcast cover art for a Japanese reflective weekly radio show.',
        'Cinematic, elegant, calm, luminous, tarot-journal mood, premium editorial design.',
        'No readable text, no letters, no logos, no watermarks.',
        'Deep navy background, soft cyan and gold glow, subtle mystical symbols, radio studio atmosphere.',
        `Theme title reference: ${params.title}`,
        params.subtitle ? `Subtitle reference: ${params.subtitle}` : '',
        params.userName ? `User mood reference: ${params.userName}'s weekly reflection` : '',
        topics ? `Conversation themes: ${topics}` : '',
    ].filter(Boolean).join(' ');
}

async function generateRadioCoverImage(
    client: ReturnType<typeof getKieApiClient>,
    script: { title: string; subtitle?: string; lines: RadioLine[] },
    userName?: string
): Promise<string> {
    if (!RADIO_COVER_ENABLED) return DEFAULT_COVER_IMAGE_URL;
    const prompt = buildRadioCoverPrompt({
        title: script.title,
        subtitle: script.subtitle,
        userName,
        scriptLines: script.lines,
    });
    try {
        const url = await client.generateImage(prompt, { aspectRatio: '1:1' });
        return typeof url === 'string' && url.trim() ? url : DEFAULT_COVER_IMAGE_URL;
    } catch (error) {
        console.warn('Radio cover generation failed, fallback to default cover:', error);
        return DEFAULT_COVER_IMAGE_URL;
    }
}

async function isPlayableAudioUrl(url: string): Promise<boolean> {
    if (!url) return false;
    const timeout = 5000;

    const tryRequest = async (method: 'HEAD' | 'GET') => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, {
                method,
                signal: controller.signal,
                cache: 'no-store',
                headers: method === 'GET' ? { Range: 'bytes=0-1' } : undefined,
            });
            return response.ok || response.status === 206;
        } catch {
            return false;
        } finally {
            clearTimeout(timer);
        }
    };

    const headOk = await tryRequest('HEAD');
    if (headOk) return true;
    return tryRequest('GET');
}

export async function POST(req: NextRequest) {
    try {
        const {
            userId: rawUserId,
            userName: providedName,
            force,
            refreshAudioOnly,
            script: refreshScript,
        } = await req.json();
        const forceRegenerate = force === true || force === 'true';

        if (!rawUserId || typeof rawUserId !== 'string' || !rawUserId.trim()) {
            return NextResponse.json({ error: 'UserId is required' }, { status: 400 });
        }
        const userId = await resolveCanonicalUserId(rawUserId.trim());
        const client = getKieApiClient();

        if (refreshAudioOnly === true || refreshAudioOnly === 'true') {
            const scriptLines = normalizeScriptLines(refreshScript);
            if (scriptLines.length === 0) {
                return NextResponse.json({ error: '有効なスクリプトがありません。' }, { status: 400 });
            }
            const audioUrl = await client.generateDialogue(scriptLines);
            return NextResponse.json({
                success: true,
                audioUrl,
                refreshed: true,
            });
        }

        // Fetch real user name from profile if available
        const profile = await getUserProfile(userId);
        const userName = profile?.displayName || providedName || 'お客様';

        // 1. Fetch journal entries from the past 7 days
        const journals = await getJournalsFromPastDays(userId, 7);
        const MIN_JOURNALS = 3;
        if (journals.length < MIN_JOURNALS) {
            return NextResponse.json({ 
                error: `ラジオを生成するには最低${MIN_JOURNALS}日分の日記が必要です（現在${journals.length}日分）。もう数日、ジャーナルをつけてからお試しください。`,
                requiredDays: MIN_JOURNALS,
                currentDays: journals.length
            }, { status: 400 });
        }

        // 2. Calculate Date Range
        const startDate = journals.length > 0 ? journals[journals.length - 1].date : ''; // Earliest journal
        const endDate = journals.length > 0 ? journals[0].date : ''; // Latest journal

        // 3. Check Cache
        const journalIds = journals.map(j => j.id).sort().join(',');
        const cacheKey = `${CACHE_PREFIX}${userId}`;
        const cached = await redis.get<CachedRadio>(cacheKey);

        if (!forceRegenerate && cached && cached.journalIds === journalIds) {
            let audioUrl = cached.audioUrl;
            if (!(await isPlayableAudioUrl(audioUrl)) && cached.script?.lines?.length) {
                audioUrl = await client.generateDialogue(cached.script.lines);
                await redis.set(cacheKey, { ...cached, audioUrl });
                await redis.expire(cacheKey, RADIO_CACHE_TTL_SEC);
            }
            const coverImageUrl = cached.coverImageUrl || DEFAULT_COVER_IMAGE_URL;
            return NextResponse.json({
                success: true,
                title: cached.script.title,
                subtitle: cached.script.subtitle,
                script: cached.script.lines,
                audioUrl,
                coverImageUrl,
                startDate: cached.startDate || startDate,
                endDate: cached.endDate || endDate,
                isNew: false,
            });
        }

        // 4. Generate Radio Script
        const script = await generateWeeklyRadioScript(userId, userName || 'お客様', journals);

        // 5. Generate Audio via Kie AI
        const audioUrl = await client.generateDialogue(script.lines);
        const coverImageUrl = await generateRadioCoverImage(client, script, userName);

        // 6. Save to Cache
        await redis.set(cacheKey, { script, audioUrl, coverImageUrl, journalIds, startDate, endDate });
        await redis.expire(cacheKey, RADIO_CACHE_TTL_SEC);

        return NextResponse.json({
            success: true,
            title: script.title,
            subtitle: script.subtitle,
            script: script.lines,
            audioUrl: audioUrl,
            coverImageUrl,
            startDate,
            endDate,
            isNew: true,
        });
    } catch (error: unknown) {
        console.error('Radio Generation Error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'ラジオの生成に失敗しました。'
        }, { status: 500 });
    }
}
