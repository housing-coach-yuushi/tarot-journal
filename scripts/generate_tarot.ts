import * as path from 'path';
import * as fs from 'fs';
// No external dependencies needed

// Simple .env loader
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
            process.env[key] = value;
        }
    });
}

const KIE_API_BASE = 'https://api.kie.ai/api/v1';
const MODEL = 'nano-banana-pro';
const OUTPUT_DIR = path.resolve(process.cwd(), 'public/tarot-assets');

// Ensure output dir exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

interface TarotCardDef {
    id: string;
    name: string;
    prompt_desc: string;
}

const MAJOR_ARCANA: TarotCardDef[] = [
    { id: '0', name: 'The Fool', prompt_desc: 'A young man standing on a cliff edge, holding a white rose and a bundle on a stick, with a small white dog barking at his feet. Bright sun in the background. Symbolizing new beginnings, innocence, spontaneity.' },
    { id: '1', name: 'The Magician', prompt_desc: 'A man standing behind a table with a cup, sword, wand, and pentacle. Infinity sign above his head. One hand pointing to sky, other to earth. Red robes. Symbolizing manifestation, resourcefulness, power.' },
    { id: '2', name: 'The High Priestess', prompt_desc: 'A woman sitting between two pillars, one black (B) and one white (J). She holds a scroll labeled TORA. Moon crown on her head, crescent moon at her feet. Veil with pomegranates behind her. Symbolizing intuition, mystery, subconscious.' },
];

async function generateCard(card: TarotCardDef) {
    const apiKey = process.env.KEIAPI_KEY || process.env.KIE_API_KEY;
    if (!apiKey) {
        console.error('Error: KIE_API_KEY (or KEIAPI_KEY) not found in .env.local');
        // Don't exit process in case we want to try others or it's just one failure
        return;
    }

    const prompt = `Tarot card design, ${card.name}. ${card.prompt_desc}. Rider-Waite-Smith style, highly detailed, 8k resolution, masterpiece, fantasy art, mystic lighting, cel shaded, vibrant colors, premium quality illustration.`;

    console.log(`Generating: ${card.name}...`);
    console.log(`Prompt: ${prompt}`);

    try {
        // 1. Create Task
        const createRes = await fetch(`${KIE_API_BASE}/jobs/createTask`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: MODEL,
                input: {
                    prompt,
                    aspect_ratio: '2:3',
                    resolution: '2K',
                    output_format: 'png',
                }
            })
        });

        const createData = await createRes.json() as any;

        if (createData.code !== 200) {
            throw new Error(`API Error: ${createData.message}`);
        }

        const taskId = createData.data.taskId;
        console.log(`Task ID: ${taskId}. Waiting for result...`);

        // 2. Poll Result
        let imageUrl = null;
        for (let i = 0; i < 60; i++) {
            await new Promise(r => setTimeout(r, 2000));

            const checkRes = await fetch(`${KIE_API_BASE}/jobs/recordInfo?taskId=${taskId}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });

            const checkData = await checkRes.json() as any;
            const data = checkData.data;

            if (data.state === 'success') {
                const result = typeof data.resultJson === 'string' ? JSON.parse(data.resultJson) : data.resultJson;
                imageUrl = result.resultUrls?.[0];
                break;
            } else if (data.state === 'fail') {
                throw new Error(`Generation failed: ${data.failMsg}`);
            }
            process.stdout.write('.');
        }
        console.log('');

        if (!imageUrl) throw new Error('Timeout waiting for image');

        // 3. Download
        console.log(`Downloading from ${imageUrl}...`);
        const imgRes = await fetch(imageUrl);
        const arrayBuffer = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const filename = `major_${card.id.padStart(2, '0')}.png`;
        fs.writeFileSync(path.join(OUTPUT_DIR, filename), buffer);
        console.log(`Saved to ${filename}`);

    } catch (e: any) {
        console.error(`Failed to generate ${card.name}:`, e.message);
    }
}

// Run
(async () => {
    console.log('Starting generation for The Fool...');
    await generateCard(MAJOR_ARCANA[0]);
    console.log('Done.');
})();
