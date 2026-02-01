
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const OUTPUT_DIR = path.resolve(process.cwd(), 'public/tarot-assets');
const ORIGINALS_DIR = path.resolve(process.cwd(), 'public/tarot-assets/originals');

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["']|["']$/g, '');
            process.env[key] = value;
        }
    });
}

const KIE_API_BASE = 'https://api.kie.ai/api/v1';
const MODEL = 'nano-banana-pro';

async function generateRemaster(filename: string) {
    const apiKey = process.env.KEIAPI_KEY || process.env.KIE_API_KEY;
    if (!apiKey) {
        console.error('Error: KEIAPI_KEY not found');
        return;
    }

    const filePath = path.join(ORIGINALS_DIR, filename);
    const basename = path.basename(filename, path.extname(filename));
    const outputFile = path.join(OUTPUT_DIR, `${basename}.png`);

    // Skip if exists? User might want to force regen.
    // Force overwrite for fixing mismatched images
    // if (fs.existsSync(outputFile)) {
    //     console.log(`[SKIP] ${basename}.png already exists`);
    //     return;
    // }

    console.log(`Remastering ${filename}...`);

    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString('base64');

    const MAJOR_NAMES = [
        "The Fool", "The Magician", "The High Priestess", "The Empress", "The Emperor",
        "The Hierophant", "The Lovers", "The Chariot", "Strength", "The Hermit",
        "Wheel of Fortune", "Justice", "The Hanged Man", "Death", "Temperance",
        "The Devil", "The Tower", "The Star", "The Moon", "The Sun",
        "Judgement", "The World"
    ];
    const RANKS = ["Ace", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Page", "Knight", "Queen", "King"];

    let cardName = "Tarot Card";
    if (basename.startsWith('major_')) {
        const id = parseInt(basename.split('_')[1]);
        if (MAJOR_NAMES[id]) cardName = MAJOR_NAMES[id];
    } else {
        const [suit, numStr] = basename.split('_');
        const num = parseInt(numStr);
        const suitName = suit.charAt(0).toUpperCase() + suit.slice(1); // cups -> Cups
        if (RANKS[num - 1]) {
            cardName = `${RANKS[num - 1]} of ${suitName}`;
        }
    }

    console.log(`Generating prompt for: ${cardName}`);

    const prompt = `Tarot card: ${cardName}. Rider-Waite-Smith style, high resolution remaster, 8k, highly detailed, vivid colors, crisp lines, masterpiece version of the original card.`;

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
                    // init_image caused 500 error. Reverting to txt2img with explicit RWS prompting.
                    // init_image: base64Image, 
                    strength: 0.35,
                    num_inference_steps: 30,
                    guidance_scale: 7.5,
                    aspect_ratio: '2:3'
                }
            })
        });

        const createData = await createRes.json() as any;

        if (createData.code !== 200) {
            console.error('Full API Response:', JSON.stringify(createData, null, 2));
            throw new Error(`API Error: ${createData.message || createData.msg || 'Unknown error'}`);
        }

        const taskId = createData.data.taskId;
        console.log(`Task ID: ${taskId}. Waiting...`);

        // 2. Poll Result
        for (let i = 0; i < 60; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const checkRes = await fetch(`${KIE_API_BASE}/jobs/recordInfo?taskId=${taskId}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });

            const checkData = await checkRes.json() as any;
            const data = checkData.data;

            if (data.state === 'success') {
                const result = typeof data.resultJson === 'string' ? JSON.parse(data.resultJson) : data.resultJson;
                const imgUrl = result.resultUrls?.[0];
                if (imgUrl) {
                    const imgRes = await fetch(imgUrl);
                    const buffer = Buffer.from(await imgRes.arrayBuffer());
                    fs.writeFileSync(outputFile, buffer);
                    console.log(`Saved to ${outputFile}`);
                    return;
                }
            } else if (data.state === 'fail') {
                throw new Error(`Generation failed: ${data.failMsg}`);
            }
            process.stdout.write('.');
        }
        throw new Error('Timeout');

    } catch (e: any) {
        console.error(`Failed to remaster ${filename}:`, e.message);
    }
}

async function main() {
    const files = fs.readdirSync(ORIGINALS_DIR).filter(f => f.endsWith('.jpg')).sort((a, b) => {
        // Prioritize major arcana
        const isAMajor = a.startsWith('major_');
        const isBMajor = b.startsWith('major_');
        if (isAMajor && !isBMajor) return -1;
        if (!isAMajor && isBMajor) return 1;
        return a.localeCompare(b);
    });
    for (const file of files) {
        // Process one by one or filter for test
        await generateRemaster(file);
    }
}

main();
