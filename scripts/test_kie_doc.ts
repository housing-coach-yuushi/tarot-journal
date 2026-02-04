
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testKieDoc() {
    const apiKey = process.env.KEIAPI_KEY;
    const url = 'https://api.kie.ai/gemini-3-flash/v1/chat/completions';

    console.log(`--- Testing with Official Doc Structure ---`);
    console.log(`URL: ${url}`);

    // Attempt 1: Content as string (standard OpenAI)
    console.log('\n--- Attempt 1: Content as String ---');
    try {
        const res = await axios.post(url, {
            messages: [
                { role: 'developer', content: 'You are a helpful assistant.' },
                { role: 'user', content: 'Say "Doc Test 1"' }
            ],
            stream: false
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        });
        console.log('Success!', JSON.stringify(res.data, null, 2));
    } catch (e: any) {
        console.log(`Failed: ${e.response?.status} - ${JSON.stringify(e.response?.data)}`);
    }

    // Attempt 2: Content as Array (following the multimodal example in doc)
    console.log('\n--- Attempt 2: Content as Array [{type: "text", text: "..."}] ---');
    try {
        const res = await axios.post(url, {
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Say "Doc Test 2"' }
                    ]
                }
            ],
            stream: false,
            include_thoughts: false
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        });
        console.log('Success!', JSON.stringify(res.data, null, 2));
    } catch (e: any) {
        console.log(`Failed: ${e.response?.status} - ${JSON.stringify(e.response?.data)}`);
    }

    // Attempt 3: Minimum payload (only user message)
    console.log('\n--- Attempt 3: Minimal Payload ---');
    try {
        const res = await axios.post(url, {
            messages: [{ role: 'user', content: 'Hi' }],
            stream: false
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        });
        console.log('Success!', JSON.stringify(res.data, null, 2));
    } catch (e: any) {
        console.log(`Failed: ${e.response?.status} - ${JSON.stringify(e.response?.data)}`);
    }
}

testKieDoc();
