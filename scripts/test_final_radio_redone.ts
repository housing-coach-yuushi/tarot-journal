
import { getUserProfile } from '../lib/db/redis';
import { getJournalsFromPastDays } from '../lib/journal/storage';
import { generateWeeklyRadioScript } from '../lib/journal/radio_script_generator';
import { getKieApiClient } from '../lib/keiapi/client';

async function testFinalRadioRedone() {
    const userId = 'user-8e8cb8d2-2342-4493-bcae-86b0f36988e2';

    try {
        const profile = await getUserProfile(userId);
        const userName = profile?.displayName || 'ユウシ';
        const journals = await getJournalsFromPastDays(userId, 7);
        console.log(`Found ${journals.length} journal entries.`);

        journals.forEach(j => {
            console.log(`[${j.date}] Summary: ${j.summary || 'Empty'}`);
            const userMsgs = j.messages.filter(m => m.role === 'user');
            console.log(`  User messages count: ${userMsgs.length}`);
            userMsgs.forEach(m => console.log(`    - ${m.content.substring(0, 50)}...`));
        });

        const client = getKieApiClient();
        const model = 'gemini-3-flash';

        console.log(`\n--- Testing Model for Script: ${model} ---`);
        try {
            const script = await generateWeeklyRadioScript(userId, userName, journals);
            console.log(`SUCCESS! Result length: ${JSON.stringify(script).length}`);
            console.log(`\n--- Script Preview ---`);
            script.lines.slice(0, 10).forEach(l => console.log(`[${l.speaker}]: ${l.text}`));
            if (script.lines.length > 10) console.log('...');
        } catch (e: any) {
            console.log(`Model ${model} failed with error: ${e.message}`);
        }
    } catch (error) {
        console.error('Production Error:', error);
    }
}

testFinalRadioRedone();
