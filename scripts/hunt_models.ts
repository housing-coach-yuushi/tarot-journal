import dotenv from 'dotenv';
import { getKieApiClient } from '../lib/keiapi/client';

dotenv.config({ path: '.env.local' });

async function huntImageModels() {
    const models = [
        'flux-schnell',
        'flux-pro',
        'black-forest-labs/flux-schnell',
        'black-forest-labs/flux-pro',
        'stability-ai/sdxl',
        'recraft-v3',
        'midjourney-v6'
    ];
    const client = getKieApiClient();

    console.log('--- Hunting for Image Generation Models ---');

    for (const model of models) {
        try {
            console.log(`Testing: ${model}...`);
            const taskId = await client.createTask(model, {
                prompt: 'App icon',
                aspect_ratio: '1:1'
            });
            console.log(`Success! ${model} is supported. TaskId: ${taskId}`);
            return; // Found one
        } catch (e: any) {
            console.log(`Failed: ${model} - ${e.message.substring(0, 100)}`);
        }
    }
}

huntImageModels();
