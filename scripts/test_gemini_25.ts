import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testGemini25Pro() {
    const apiKey = process.env.KEIAPI_KEY;
    const url = 'https://api.kie.ai/gemini-2.5-pro/v1/chat/completions';

    console.log(`--- Testing Gemini 2.5 Pro ---`);
    console.log(`URL: ${url}`);

    if (!apiKey) {
        console.error('Error: KEIAPI_KEY is not set in .env.local');
        return;
    }

    try {
        const response = await axios({
            method: 'post',
            url: url,
            data: {
                messages: [{ role: 'user', content: 'Say "Working"' }],
                stream: false,
                include_thoughts: true
            },
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Response Status:', response.status);
        console.log('Response Data:', JSON.stringify(response.data, null, 2));
    } catch (e: any) {
        if (e.response) {
            console.log(`Failed: ${e.response.status} - ${JSON.stringify(e.response.data)}`);
        } else {
            console.log(`Error: ${e.message}`);
        }
    }
}

testGemini25Pro();
