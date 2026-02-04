
import { getKieApiClient } from '../lib/keiapi/client';

async function finalModelHunt() {
    const client = getKieApiClient();
    const models = [
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gpt-4o-mini',
        'gpt-4o',
        'claude-3-5-sonnet',
        'deepseek-v3',
        'deepseek-r1',
        'minimax-abab6.5-chat'
    ];

    for (const model of models) {
        console.log(`\n--- Testing Model: ${model} ---`);
        try {
            const response = await client.chat([
                { role: 'user', content: 'Say "Hi"' }
            ], model);
            console.log(`Success with ${model}: "${response}"`);
            if (response && response.length > 0) {
                console.log(`FOUND WORKING MODEL: ${model}`);
            }
        } catch (e: any) {
            console.log(`Failed ${model}: ${e.message}`);
        }
    }
}

finalModelHunt();
