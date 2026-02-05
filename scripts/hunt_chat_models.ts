import dotenv from 'dotenv';
import { getKieApiClient } from '../lib/keiapi/client';

dotenv.config({ path: '.env.local' });

async function huntModels() {
    const models = [
        'gemini-3-flash',
        'gemini-3-pro',
        'gemini-2.0-flash-exp',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'deepseek-v3',
        'deepseek-r1',
        'gpt-4o',
        'claude-3-5-sonnet',
    ];
    const client = getKieApiClient();

    console.log('--- Hunting for Working Models ---');

    for (const model of models) {
        try {
            console.log(`Testing: ${model}...`);
            const response = await client.chat([
                { role: 'user', content: 'Say "Hi"' }
            ], model);
            console.log(`✅ Success with ${model}: ${response}`);
        } catch (e: any) {
            console.error(`❌ Failed with ${model}: ${e.message}`);
        }
    }
}

huntModels();
