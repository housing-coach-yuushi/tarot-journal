import { NextRequest, NextResponse } from 'next/server';
import {
    getTodayJournal,
    getJournalByDate,
    getRecentJournals,
    getJournalDates,
    getStreak,
    updateJournal,
} from '@/lib/journal/storage';
import { resolveCanonicalUserId } from '@/lib/db/redis';

function resolveRequestUserId(raw: unknown): Promise<string> | string {
    const forced = (process.env.FORCE_USER_ID || '').trim();
    if (typeof raw !== 'string') return forced || 'default';
    const userId = raw.trim();
    if (!userId || userId === 'default') return forced || 'default';
    return resolveCanonicalUserId(userId);
}

// GET - Get journal data
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const userId = await resolveRequestUserId(searchParams.get('userId'));
    const date = searchParams.get('date');
    const action = searchParams.get('action');

    try {
        // Get specific date's journal
        if (date) {
            const entry = await getJournalByDate(userId, date);
            return NextResponse.json({ entry });
        }

        // Get recent journals
        if (action === 'recent') {
            const limit = parseInt(searchParams.get('limit') || '7');
            const entries = await getRecentJournals(userId, limit);
            return NextResponse.json({ entries });
        }

        // Get all journal dates
        if (action === 'dates') {
            const dates = await getJournalDates(userId);
            return NextResponse.json({ dates });
        }

        // Get streak
        if (action === 'streak') {
            const streak = await getStreak(userId);
            return NextResponse.json({ streak });
        }

        // Default: Get today's journal
        const entry = await getTodayJournal(userId);
        const streak = await getStreak(userId);

        return NextResponse.json({
            entry,
            streak,
        });

    } catch (error) {
        console.error('Journal API Error:', error);
        return NextResponse.json(
            { error: 'Failed to get journal' },
            { status: 500 }
        );
    }
}

// PATCH - Update journal (summary, mood, etc.)
export async function PATCH(request: NextRequest) {
    try {
        const { userId: rawUserId = 'default', date, summary, mood } = await request.json();
        const userId = await resolveRequestUserId(rawUserId);

        if (!date) {
            return NextResponse.json(
                { error: 'Date is required' },
                { status: 400 }
            );
        }

        const updates: { summary?: string; mood?: string } = {};
        if (summary !== undefined) updates.summary = summary;
        if (mood !== undefined) updates.mood = mood;

        const entry = await updateJournal(userId, date, updates);

        if (!entry) {
            return NextResponse.json(
                { error: 'Journal not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ entry });

    } catch (error) {
        console.error('Journal API Error:', error);
        return NextResponse.json(
            { error: 'Failed to update journal' },
            { status: 500 }
        );
    }
}
