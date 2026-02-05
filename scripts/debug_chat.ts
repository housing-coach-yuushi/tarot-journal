import dotenv from 'dotenv';
import { getKieApiClient } from '../lib/keiapi/client';

dotenv.config({ path: '.env.local' });

async function debugChat() {
    const models = ['gemini-3-flash', 'gemini-3-pro', 'deepseek-v3', 'deepseek-r1'];
    const client = getKieApiClient();

    for (const model of models) {
        try {
            console.log(`\n--- Testing model: ${model} ---`);
            const response = await client.chat([
                { role: 'user', content: 'Say "Working"' }
            ], model);
            console.log(`Success! Response: ${response.substring(0, 50)}`);
        } catch (e: any) {
            console.error(`Failed with ${model}: ${e.message}`);
        }
    }
}

debugChat();
