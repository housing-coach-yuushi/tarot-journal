
import { getKieApiClient } from '../lib/keiapi/client';

async function testKieMinimal() {
    const client = getKieApiClient();
    const model = 'gemini-3-flash';
    console.log(`Testing Kie AI Minimal: ${model}`);

    try {
        const response = await client.chat([
            { role: 'user', content: 'Say "I am alive!"' }
        ], model);
        console.log(`Response: "${response}"`);
    } catch (e: any) {
        console.error(`Error:`, e.message);
    }
}

testKieMinimal();
