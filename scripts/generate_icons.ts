import dotenv from 'dotenv';
import { getKieApiClient } from '../lib/keiapi/client';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

dotenv.config({ path: '.env.local' });

const PROMPTS = [
    {
        name: 'apple_sf_mystic',
        prompt: 'Professional Apple design language app icon, a single minimalist gold star inside a sleek frosted glass tarot card silhouette, vibrant deep violet to indigo gradient background, premium iOS aesthetic, SF style.'
    },
    {
        name: 'apple_journal_pulse',
        prompt: 'Professional Apple design language app icon, a minimalist white sound waveform shaped like a crescent moon, on a deep navy blue background with subtle glassmorphism, clean and premium iOS style.'
    },
    {
        name: 'apple_minimalist_card',
        prompt: 'Professional Apple style app icon, a ultra-minimalist white tarot card with a single glowing golden eye in the center, simple purple gradient background, sophisticated squircle shape, Apple design system.'
    },
    {
        name: 'apple_voice_tarot',
        prompt: 'Professional Apple style app icon, a 3D translucent glass tarot card with a pulsing Siri-like soundwave inside, premium materials, deep cosmic black background, high-end Apple hardware aesthetic.'
    }
];

async function generateIcons() {
    const client = getKieApiClient();
    const resultsFolder = path.join(process.cwd(), 'public/icon-options');

    if (!fs.existsSync(resultsFolder)) {
        fs.mkdirSync(resultsFolder, { recursive: true });
    }

    console.log('--- George Tarot Journal Icon Generation ---');

    for (const p of PROMPTS) {
        try {
            console.log(`\nGenerating: ${p.name}...`);
            // Using nano-banana-pro which is confirmed working in this project
            const imageUrl = await client.createTaskAndWait('nano-banana-pro', {
                prompt: p.prompt,
                aspect_ratio: '1:1',
                output_format: 'png'
            });

            console.log(`Success! Downloading from: ${imageUrl}`);

            const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const filePath = path.join(resultsFolder, `${p.name}.png`);
            fs.writeFileSync(filePath, Buffer.from(response.data));

            console.log(`Saved to: ${filePath}`);
        } catch (e: any) {
            console.error(`Failed to generate ${p.name}:`, e.message);
        }
    }

    console.log('\n--- All generations finished ---');
}

generateIcons();
