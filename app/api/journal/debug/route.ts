import { NextRequest, NextResponse } from 'next/server';
import { getJournalDates, getJournalByDate } from '@/lib/journal/storage';
import { resolveCanonicalUserId } from '@/lib/db/redis';

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const rawUserId = searchParams.get('userId');

    if (!rawUserId) {
        return NextResponse.json({ error: 'UserId is required' }, { status: 400 });
    }

    try {
        const userId = await resolveCanonicalUserId(rawUserId);
        const dates = await getJournalDates(userId);
        const entries = [];

        for (const date of dates) {
            const entry = await getJournalByDate(userId, date);
            if (entry) {
                entries.push({
                    date: entry.date,
                    messageCount: entry.messages.length,
                    hasSummary: !!entry.summary,
                });
            }
        }

        return NextResponse.json({
            userId,
            totalDates: dates.length,
            dates,
            entries,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
