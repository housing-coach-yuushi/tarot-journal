
const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = path.resolve(process.cwd(), 'public/tarot-assets/originals/wands_09.jpg');

async function getImageUrl(filename) {
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

async function downloadImage(url, filepath) {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'GeorgeTarotJournal/1.0 (https://github.com/yuushinakashima)' }
    });
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(filepath, buffer);
}

async function main() {
    const patterns = [
        'RWS_Tarot_09_Wands.jpg',
        'Wands09.jpg',
        'Wands_09.jpg',
        '09_Wands.jpg',
        'Tarot_Nine_of_Wands.jpg'
    ];

    for (const pattern of patterns) {
        console.log(`Trying ${pattern}...`);
        const url = await getImageUrl(pattern);
        if (url) {
            console.log(`Found: ${url}`);
            await downloadImage(url, OUTPUT_PATH);
            console.log('Saved to public/tarot-assets/originals/wands_09.jpg');
            return;
        }
    }
    console.error('Could not find Nine of Wands image.');
}

main();
