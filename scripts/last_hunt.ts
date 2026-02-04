
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function hunt() {
    const apiKey = process.env.KEIAPI_KEY;
    const models = [
        'gemini-3-flash',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gpt-4o-mini',
        'gpt-4o',
        'qwen-2.5-72b-instruct'
    ];

    for (const model of models) {
        console.log(`\n--- Model: ${model} ---`);
        try {
            const response = await axios.post(`https://api.kie.ai/${model}/v1/chat/completions`, {
                messages: [
                    { role: 'user', content: 'Say hi' }
                ],
                stream: false
            }, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            console.log(`Success! Full Data: ${JSON.stringify(response.data)}`);
            const content = response.data.choices?.[0]?.message?.content || response.data.content || '';
            console.log(`Content: ${content}`);
        } catch (e: any) {
            console.log(`Status ${e.response?.status}: ${JSON.stringify(e.response?.data)}`);
        }
    }

    // Try OpenAI style path
    console.log(`\n--- OpenAI Style Path ---`);
    try {
        const response = await axios.post(`https://api.kie.ai/v1/chat/completions`, {
            model: 'gemini-3-flash',
            messages: [{ role: 'user', content: 'Say hi' }]
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        console.log(`Success!`);
    } catch (e: any) {
        console.log(`Status ${e.response?.status}: ${JSON.stringify(e.response?.data)}`);
    }
}

hunt();
