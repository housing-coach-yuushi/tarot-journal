
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function huntV2() {
    const apiKey = process.env.KEIAPI_KEY;
    const models = [
        'nano-banana-pro',
        'gemini-3-pro',
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'deepseek-v3',
        'deepseek-r1'
    ];

    for (const model of models) {
        console.log(`\n--- Model: ${model} ---`);
        try {
            const response = await axios.post(`https://api.kie.ai/${model}/v1/chat/completions`, {
                messages: [{ role: 'user', content: 'Say "Working"' }],
                stream: false
            }, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            console.log(`Status ${response.status}: ${JSON.stringify(response.data)}`);
        } catch (e: any) {
            console.log(`Http Status ${e.response?.status}: ${JSON.stringify(e.response?.data)}`);
        }
    }
}

huntV2();
