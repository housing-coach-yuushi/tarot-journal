
import { getKieApiClient } from '../lib/keiapi/client';

async function finalModelHunt() {
    const client = getKieApiClient();
    const models = ['gemini', 'gemini-1.5-flash', 'gemini-1.5-pro', 'google/gemini-3-flash'];

    for (const model of models) {
        console.log(`\n--- Testing Model: ${model} ---`);
        try {
            const response = await client.chat([
                { role: 'user', content: 'Hi' }
            ], model);
            console.log(`Status with ${model}: ${response ? 'Received Content' : 'Empty Content'}`);
            if (response) {
                console.log(`Content: "${response}"`);
                break;
            }
        } catch (e: any) {
            console.log(`Failed ${model}: ${e.message}`);
        }
    }
}

finalModelHunt();
