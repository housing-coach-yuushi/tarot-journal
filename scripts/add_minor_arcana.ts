
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const cardsPath = path.resolve(process.cwd(), 'lib/tarot/cards.ts');
let content = fs.readFileSync(cardsPath, 'utf8');

// 1. Update interface if not already updated
if (!content.includes('suit?: string;')) {
    content = content.replace(
        /interface TarotCard \{/,
        'interface TarotCard {\n  suit?: string;\n  rank?: string;'
    );
    console.log('Updated TarotCard interface.');
}

// 2. Generate Minor Arcana Data
const SUITS = ['Wands', 'Cups', 'Swords', 'Pentacles'];
const RANKS = [
    { name: 'Ace', num: '01' },
    { name: 'Two', num: '02' },
    { name: 'Three', num: '03' },
    { name: 'Four', num: '04' },
    { name: 'Five', num: '05' },
    { name: 'Six', num: '06' },
    { name: 'Seven', num: '07' },
    { name: 'Eight', num: '08' },
    { name: 'Nine', num: '09' },
    { name: 'Ten', num: '10' },
    { name: 'Page', num: '11' },
    { name: 'Knight', num: '12' },
    { name: 'Queen', num: '13' },
    { name: 'King', num: '14' }
];

const ELEMENTS: Record<string, string> = {
    'Wands': 'Fire',
    'Cups': 'Water',
    'Swords': 'Air',
    'Pentacles': 'Earth'
};

const COLORS: Record<string, string> = {
    'Wands': '#E34234', // Fire/Red
    'Cups': '#4169E1', // Water/Blue
    'Swords': '#C0C0C0', // Air/Silver
    'Pentacles': '#228B22' // Earth/Green
};

let idCounter = 22;
const minorCards: any[] = [];

for (const suit of SUITS) {
    for (const rank of RANKS) {
        const imageName = `${suit.toLowerCase()}_${rank.num}.png`;

        // Basic placeholder text generation
        const upright = `The ${rank.name} of ${suit} signifies the essence of ${ELEMENTS[suit]} in the realm of ${rank.name}.`;
        const reversed = `Reversed, the ${rank.name} of ${suit} suggests a blockage or internal focus on ${ELEMENTS[suit]} energy.`;

        minorCards.push({
            id: idCounter,
            name: `${rank.name} of ${suit}`,
            suit: suit,
            rank: rank.name,
            symbol: `${rank.name}`,
            keywords: [suit, rank.name, ELEMENTS[suit]],
            image: `/tarot-assets/${imageName}`,
            meaning: {
                upright: upright,
                reversed: reversed
            },
            reflection: {
                morning: `How does the energy of the ${rank.name} of ${suit} influence your start today?`,
                evening: `In what ways did you experience the ${rank.name} of ${suit} today?`
            },
            element: ELEMENTS[suit],
            themeColor: COLORS[suit],
            videoFile: 'placeholder.mp4'
        });
        idCounter++;
    }
}

// 3. Append to file
const minorDataCode = `
export const MINOR_ARCANA: TarotCard[] = ${JSON.stringify(minorCards, null, 2)};

export const ALL_CARDS: TarotCard[] = [...MAJOR_ARCANA, ...MINOR_ARCANA];
`;

if (!content.includes('export const MINOR_ARCANA')) {
    content += minorDataCode;
    console.log('Appended MINOR_ARCANA and ALL_CARDS.');
} else {
    console.log('MINOR_ARCANA already exists. Skipping append.');
}

fs.writeFileSync(cardsPath, content);
console.log('Done.');
