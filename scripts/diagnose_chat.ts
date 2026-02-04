
import { getKieApiClient } from '../lib/keiapi/client';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

async function diagnoseChat() {
    const client = getKieApiClient();
    const models = ['gemini-3-flash', 'gemini-1.5-flash'];

    for (const model of models) {
        console.log(`--- Testing Model: ${model} ---`);
        try {
            const response = await client.chat([
                { role: 'user', content: 'Say "Hello, I am ready!"' }
            ], model);
            console.log(`Response: "${response}"`);
        } catch (e) {
            console.error(`Error with ${model}:`, e);
        }
    }
}

diagnoseChat();
