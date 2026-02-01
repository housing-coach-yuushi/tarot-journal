
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.resolve(process.cwd(), 'public/tarot-assets');
const EXPECTED_FILES = [
    ...Array.from({ length: 22 }, (_, i) => `major_${i.toString().padStart(2, '0')}.png`),
    ...['wands', 'cups', 'swords', 'pentacles'].flatMap(suit =>
        Array.from({ length: 14 }, (_, i) => `${suit}_${(i + 1).toString().padStart(2, '0')}.png`)
    )
];

console.log(`Auditing ${EXPECTED_FILES.length} files in ${ASSETS_DIR}...`);

const missing = [];
const small = [];

EXPECTED_FILES.forEach(file => {
    const filePath = path.join(ASSETS_DIR, file);
    if (!fs.existsSync(filePath)) {
        missing.push(file);
    } else {
        const stats = fs.statSync(filePath);
        if (stats.size < 100000) {
            small.push({ file, size: stats.size });
        }
    }
});

console.log('\n--- Missing Files ---');
missing.forEach(f => console.log(f));

console.log('\n--- Suspiciously Small Files (<100KB) ---');
small.forEach(s => console.log(`${s.file}: ${s.size} bytes`));

if (missing.length === 0 && small.length === 0) {
    console.log('\n✅ All assets look good!');
}
