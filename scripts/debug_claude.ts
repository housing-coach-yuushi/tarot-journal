import dotenv from 'dotenv';
import { chatWithClaude } from '../lib/anthropic/client';

dotenv.config({ path: '.env.local' });

async function debugClaude() {
    try {
        console.log('--- Testing Claude API ---');
        console.log('Key:', process.env.ANTHROPIC_API_KEY ? 'Set' : 'Not Set');

        const response = await chatWithClaude([
            { role: 'system', content: 'あなたはタロット占い師のジョージです。' },
            { role: 'user', content: 'こんにちは' }
        ]);

        console.log('✅ Success! Claude says:');
        console.log(response);
    } catch (e: any) {
        console.error('❌ Failed with Claude:');
        console.error(e);
    }
}

debugClaude();
