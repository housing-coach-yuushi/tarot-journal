import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function extendedHunt() {
    const apiKey = process.env.KEIAPI_KEY;
    const models = [
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-2.0-flash',
        'qwen-2.5-72b-instruct'
    ];

    for (const model of models) {
        console.log(`\n--- Model: ${model} ---`);
        try {
            const response = await axios.post(`https://api.kie.ai/${model}/v1/chat/completions`, {
                messages: [
                    { role: 'user', content: 'Say "Working"' }
                ],
                stream: false
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`Response Status: ${response.status}`);
            console.log(`Response Data: ${JSON.stringify(response.data)}`);
        } catch (e: any) {
            console.log(`Status ${e.response?.status}: ${JSON.stringify(e.response?.data)}`);
        }
    }
}

extendedHunt();
