
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cardsPath = path.resolve(process.cwd(), 'lib/tarot/cards.ts');
let content = fs.readFileSync(cardsPath, 'utf8');

// The pattern matches lines like:
// videoFile: "Sun.mp4"
// We want to append image: "/tarot-assets/major_XX.png" after it.

// First, let's identify card blocks by ID using a loop to be safe
// Or use regex with capture groups.

// Pattern:
// id: (\d+),
// (any lines until)
// videoFile: "(.+)"

// We process the file line by line statefully could be safer, but regex replacer with updated ID context is easier.
// However, the distance between id and videoFile varies.

// Let's use a simpler approach: regex replace videoFile line, but we need the ID.
// The file is structured nicely. We can find all blocks.

content = content.replace(/(id:\s*(\d+),[\s\S]*?videoFile:\s*"[^"]+")/g, (match, block, id) => {
    // Check if image already exists in this block
    if (match.includes('image:')) {
        return match;
    }

    const idNum = parseInt(id, 10);
    const idStr = idNum.toString().padStart(2, '0');
    // Add comma if missing (it shouldn't be based on current file)

    // Insert image property
    return `${match},\n    image: "/tarot-assets/major_${idStr}.png"`;
});

fs.writeFileSync(cardsPath, content);
console.log('Updated cards.ts with image paths.');
