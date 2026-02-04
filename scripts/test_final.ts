
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testFinal() {
    const apiKey = process.env.KEIAPI_KEY;
    const models = ['gpt-4o-mini', 'gpt-4o', 'qwen-2.5-72b-instruct'];

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

testFinal();
