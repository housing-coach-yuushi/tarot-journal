
import { getKieApiClient } from '../lib/keiapi/client';

async function endpointHunt() {
    const client = getKieApiClient();
    const model = 'gemini-3-flash';
    const endpoints = [
        'https://api.kie.ai/gemini-3-flash/v1/chat/completions',
        'https://api.kie.ai/api/gemini-3-flash/v1/chat/completions',
        'https://api.kie.ai/v1/chat/completions',
        'https://api.kie.ai/api/v1/chat/completions'
    ];

    for (const endpoint of endpoints) {
        console.log(`\n--- Testing Endpoint: ${endpoint} ---`);
        try {
            const body: any = {
                messages: [{ role: 'user', content: 'Hi' }],
                stream: false
            };
            if (!endpoint.includes('gemini-3-flash')) {
                body.model = 'gemini-3-flash';
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.KEIAPI_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            const text = await response.text();
            console.log(`Status: ${response.status}`);
            console.log(`Response: ${text.substring(0, 100)}`);
        } catch (e: any) {
            console.log(`Failed: ${e.message}`);
        }
    }
}

endpointHunt();
