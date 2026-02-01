
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM environment fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.resolve(process.cwd(), 'public/tarot-assets/originals');

// Ensure output dir
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// RWS File names on Wikimedia Commons
// Format: File:RWS_Tarot_[XX]_[Name].jpg
const CARDS = [
    { id: '00', name: 'Fool' },
    { id: '01', name: 'Magician' },
    { id: '02', name: 'High_Priestess' },
    { id: '03', name: 'Empress' },
    { id: '04', name: 'Emperor' },
    { id: '05', name: 'Hierophant' },
    { id: '06', name: 'Lovers' },
    { id: '07', name: 'Chariot' },
    { id: '08', name: 'Strength' },
    { id: '09', name: 'Hermit' },
    { id: '10', name: 'Wheel_of_Fortune' },
    { id: '11', name: 'Justice' },
    { id: '12', name: 'Hanged_Man' },
    { id: '13', name: 'Death' },
    { id: '14', name: 'Temperance' },
    { id: '15', name: 'Devil' },
    { id: '16', name: 'Tower' },
    { id: '17', name: 'Star' },
    { id: '18', name: 'Moon' },
    { id: '19', name: 'Sun' },
    { id: '20', name: 'Judgement' },
    { id: '21', name: 'World' },
];


const SUITS = ['Wands', 'Cups', 'Swords', 'Pentacles'];
const SUIT_ALIASES: Record<string, string[]> = {
    'Wands': ['Wands'],
    'Cups': ['Cups'],
    'Swords': ['Swords'],
    'Pentacles': ['Pentacles', 'Pents', 'Coins']
};

const MINOR_RANKS = [
    { id: 'Ace', num: '01', names: ['Ace', '01', '1'] },
    { id: 'Two', num: '02', names: ['Two', '02', '2'] },
    { id: 'Three', num: '03', names: ['Three', '03', '3'] },
    { id: 'Four', num: '04', names: ['Four', '04', '4'] },
    { id: 'Five', num: '05', names: ['Five', '05', '5'] },
    { id: 'Six', num: '06', names: ['Six', '06', '6'] },
    { id: 'Seven', num: '07', names: ['Seven', '07', '7'] },
    { id: 'Eight', num: '08', names: ['Eight', '08', '8'] },
    { id: 'Nine', num: '09', names: ['Nine', '09', '9'] },
    { id: 'Ten', num: '10', names: ['Ten', '10'] },
    { id: 'Page', num: '11', names: ['Page', '11'] },
    { id: 'Knight', num: '12', names: ['Knight', '12'] },
    { id: 'Queen', num: '13', names: ['Queen', '13'] },
    { id: 'King', num: '14', names: ['King', '14'] }
];

// Add Minor Arcana to CARDS
SUITS.forEach(suit => {
    // This section is now effectively unused as the download logic is in main
    // and uses MINOR_RANKS directly. Keeping it for now as it was in original.
    // ID needs to be unique if used for mapping.
    // We will use filenames: [suit]_[rank].jpg
    // For download logic, we store search patterns.
});

async function getImageUrl(filename: string): Promise<string | null> {
    const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${filename}&prop=imageinfo&iiprop=url&format=json&origin=*`;
    try {
        const res = await fetch(apiUrl);
        const data = await res.json();
        const pages = data.query.pages;
        const pageId = Object.keys(pages)[0];
        if (pageId === '-1') return null;
        return pages[pageId].imageinfo[0].url;
    } catch (e) {
        return null;
    }
}

async function downloadImage(url: string, filepath: string) {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'GeorgeTarotJournal/1.0 (https://github.com/yuushinakashima)' }
    });
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(filepath, buffer);
}

async function findAndDownload(patterns: string[], targetFilename: string) {
    const targetPath = path.join(OUTPUT_DIR, targetFilename);
    if (fs.existsSync(targetPath)) {
        console.log(`[SKIP] ${targetFilename}`);
        return;
    }

    for (const pattern of patterns) {
        process.stdout.write(`Trying ${pattern}... `);
        const url = await getImageUrl(pattern);
        if (url) {
            console.log('Found.');
            await downloadImage(url, targetPath);
            console.log(`Saved to ${targetFilename}`);
            return;
        }
        console.log('Not found.');
        await new Promise(r => setTimeout(r, 500)); // Rate limit
    }
    console.error(`[FAIL] Could not find image for ${targetFilename}`);
}

async function main() {
    console.log('Downloading Major Arcana...');
    for (const card of CARDS) {
        // Basic Major Arcana download logic
        await findAndDownload([
            `RWS_Tarot_${card.id}_${card.name}.jpg`,
            `RWS_Tarot_${card.id}_${card.name}.jpeg`
        ], `major_${card.id}.jpg`);
    }

    console.log('Downloading Minor Arcana...');
    for (const suit of SUITS) {
        for (const rank of MINOR_RANKS) {
            const aliases = SUIT_ALIASES[suit];
            const patterns: string[] = [];

            aliases.forEach(s => {
                rank.names.forEach(r => {
                    // Pattern: Wands01.jpg
                    patterns.push(`${s}${r}.jpg`);
                    // Pattern: Wands_01.jpg
                    patterns.push(`${s}_${r}.jpg`);
                    // Pattern: RWS_Tarot_Wands_Ace.jpg
                    patterns.push(`RWS_Tarot_${s}_${r}.jpg`);
                    // Pattern: 01_of_Wands.jpg
                    patterns.push(`${r}_of_${s}.jpg`);
                    // Pattern: Ace_of_Wands.jpg
                    patterns.push(`${r}_of_${s}.jpg`); // Duplicate but safe
                });
            });

            // Specific manual overrides based on common wiki filenames
            // e.g. "Ace of Wands (Rider-Waite).jpg" ?
            // We'll stick to short names first.

            // Output filename: wands_01.jpg, wands_14.jpg
            const targetName = `${suit.toLowerCase()}_${rank.num}.jpg`;

            await findAndDownload(patterns, targetName);
        }
    }

    console.log('Done.');
}


main().catch(console.error);
