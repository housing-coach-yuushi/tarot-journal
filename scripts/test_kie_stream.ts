
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testKieStream() {
    const apiKey = process.env.KEIAPI_KEY;
    const url = 'https://api.kie.ai/gemini-3-flash/v1/chat/completions';

    console.log(`--- Testing Streaming ---`);
    try {
        const response = await axios({
            method: 'post',
            url: url,
            data: {
                messages: [{ role: 'user', content: 'Say "I am working in stream mode"' }],
                stream: true,
                include_thoughts: true
            },
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            responseType: 'stream'
        });

        console.log('Stream opened. Reading...');

        response.data.on('data', (chunk: Buffer) => {
            console.log('CHUNK:', chunk.toString());
        });

        response.data.on('end', () => {
            console.log('Stream ended.');
        });

    } catch (e: any) {
        if (e.response) {
            // Read stream error body if possible
            let body = '';
            e.response.data.on('data', (chunk: Buffer) => body += chunk.toString());
            e.response.data.on('end', () => console.log(`Failed: ${e.response.status} - ${body}`));
        } else {
            console.log(`Error: ${e.message}`);
        }
    }
}

testKieStream();
