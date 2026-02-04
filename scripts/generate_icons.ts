import dotenv from 'dotenv';
import { getKieApiClient } from '../lib/keiapi/client';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

dotenv.config({ path: '.env.local' });

const PROMPTS = [
    {
        name: 'mystic_gold_mic_v2',
        prompt: 'Professional iOS app icon, a floating vintage golden studio microphone emitting celestial stardust, HUGE safe margin around the edges, centered design with lots of negative space, deep midnight purple background, premium 3D render, Apple human interface guidelines compliant.'
    }
];

async function generateIcons() {
    const client = getKieApiClient();
    const resultsFolder = path.join(process.cwd(), 'public/icon-options');

    if (!fs.existsSync(resultsFolder)) {
        fs.mkdirSync(resultsFolder, { recursive: true });
    }

    console.log('--- George Tarot Journal Icon Re-generation (Padded) ---');

    for (const p of PROMPTS) {
        try {
            console.log(`\nGenerating: ${p.name}...`);
            const imageUrl = await client.createTaskAndWait('nano-banana-pro', {
                prompt: p.prompt,
                aspect_ratio: '1:1',
                output_format: 'png'
            });

            console.log(`Success! Downloading from: ${imageUrl}`);

            const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const filePath = path.join(resultsFolder, `${p.name}.png`);
            fs.writeFileSync(filePath, Buffer.from(response.data));

            // Immediately apply as the main icon
            fs.copyFileSync(filePath, path.join(process.cwd(), 'public/icon.png'));
            fs.copyFileSync(filePath, path.join(process.cwd(), 'public/apple-touch-icon.png'));

            console.log(`Saved and applied to public/icon.png`);
        } catch (e: any) {
            console.error(`Failed to generate ${p.name}:`, e.message);
        }
    }

    console.log('\n--- Generation finished ---');
}

generateIcons();
