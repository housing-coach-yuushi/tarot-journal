/**
 * Available TTS voices from Deepgram Aura-2 (Japanese)
 */

export interface VoiceOption {
    id: string;
    name: string; // API model name
    label: string; // UI name (Japanese)
    gender: 'male' | 'female' | 'neutral';
    description: string;
    age: 'young' | 'middle' | 'mature';
}

// Deepgram Aura-2 Japanese voices
export const JAPANESE_VOICES: VoiceOption[] = [
    // Male voices
    {
        id: 'aura-2-fujin-ja',
        name: 'fujin',
        label: 'フウジン',
        gender: 'male',
        description: '落ち着いた自信のある男性声',
        age: 'middle',
    },
    {
        id: 'aura-2-ebisu-ja',
        name: 'ebisu',
        label: 'エビス',
        gender: 'male',
        description: '深みのある穏やかな男性声',
        age: 'young',
    },
    // Female voices
    {
        id: 'aura-2-izanami-ja',
        name: 'izanami',
        label: 'イザナミ',
        gender: 'female',
        description: '明瞭で丁寧な女性声',
        age: 'middle',
    },
    {
        id: 'aura-2-uzume-ja',
        name: 'uzume',
        label: 'ウズメ',
        gender: 'female',
        description: '親しみやすく明るい女性声',
        age: 'young',
    },
    {
        id: 'aura-2-ama-ja',
        name: 'ama',
        label: 'アマ',
        gender: 'female',
        description: '自然体で安心感のある女性声',
        age: 'middle',
    },
];

// Default conversation voice (Deepgram Aura-2 Japanese, fixed for stability)
export const DEFAULT_VOICE_ID = 'aura-2-fujin-ja';

/**
 * Get voice by ID
 */
export function getVoiceById(id: string): VoiceOption | undefined {
    return JAPANESE_VOICES.find(v => v.id === id);
}

/**
 * Get voices by gender
 */
export function getVoicesByGender(gender: 'male' | 'female' | 'neutral'): VoiceOption[] {
    return JAPANESE_VOICES.filter(v => v.gender === gender);
}

/**
 * Get formatted voice list for prompts
 */
export function getVoiceListForPrompt(): string {
    return JAPANESE_VOICES.map(v =>
        `- ${v.name} (${v.gender === 'male' ? '男性' : v.gender === 'female' ? '女性' : '中性'}): ${v.description}`
    ).join('\n');
}

/**
 * Get voice ID by name (case-insensitive)
 */
export function getVoiceIdByName(name: string): string | undefined {
    const normalized = name.toLowerCase();
    const voice = JAPANESE_VOICES.find(v =>
        v.name.toLowerCase() === normalized ||
        v.label.toLowerCase() === normalized ||
        v.id.toLowerCase() === normalized
    );
    if (voice) return voice.id;

    const legacyMap: Record<string, string> = {
        george: 'aura-2-fujin-ja',
        'ジョージ': 'aura-2-fujin-ja',
        daniel: 'aura-2-fujin-ja',
        'ダニエル': 'aura-2-fujin-ja',
        charlie: 'aura-2-ebisu-ja',
        'チャーリー': 'aura-2-ebisu-ja',
        callum: 'aura-2-ebisu-ja',
        'カラム': 'aura-2-ebisu-ja',
        liam: 'aura-2-ebisu-ja',
        'リアム': 'aura-2-ebisu-ja',
        aria: 'aura-2-izanami-ja',
        'アリア': 'aura-2-izanami-ja',
        sarah: 'aura-2-ama-ja',
        'サラ': 'aura-2-ama-ja',
        charlotte: 'aura-2-izanami-ja',
        'シャーロット': 'aura-2-izanami-ja',
        lily: 'aura-2-uzume-ja',
        'リリー': 'aura-2-uzume-ja',
    };

    return legacyMap[normalized] || legacyMap[name];
}
