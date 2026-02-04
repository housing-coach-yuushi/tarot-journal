
import { getUserProfile } from '../lib/db/redis';
import { getJournalsFromPastDays } from '../lib/journal/storage';
import { generateWeeklyRadioScript } from '../lib/journal/radio_script_generator';

async function verifyRadioFix() {
    const userId = 'user-8e8cb8d2-2342-4493-bcae-86b0f36988e2'; // ユウシ
    console.log(`--- Verifying Radio Fix for User: ${userId} ---`);

    try {
        const profile = await getUserProfile(userId);
        const userName = profile?.displayName || 'ユウシ';
        console.log(`User Name: ${userName}`);

        const journals = await getJournalsFromPastDays(userId, 7);
        console.log(`Found ${journals.length} journals for the past 7 days.`);

        if (journals.length === 0) {
            console.log('Fetching older journals for testing...');
            // If no data in past 7 days, let's just use whatever they have in the index
            const getRecentJournals = require('../lib/journal/storage').getRecentJournals;
            const fallbackJournals = await getRecentJournals(userId, 7);
            console.log(`Using ${fallbackJournals.length} recent journals instead.`);

            const script = await generateWeeklyRadioScript(userId, userName, fallbackJournals);
            console.log(`\nScript Title: ${script.title}`);
            script.lines.forEach(l => console.log(`[${l.speaker}]: ${l.text}`));
        } else {
            const script = await generateWeeklyRadioScript(userId, userName, journals);
            console.log(`\nScript Title: ${script.title}`);
            script.lines.forEach(l => console.log(`[${l.speaker}]: ${l.text}`));
        }
    } catch (error) {
        console.error('Verification Failed:', error);
    }
}

verifyRadioFix();
