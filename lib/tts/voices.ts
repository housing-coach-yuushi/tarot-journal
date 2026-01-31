/**
 * Available TTS voices from ElevenLabs via Kie.ai (Turbo 2.5 compatible)
 */

export interface VoiceOption {
    id: string;
    name: string;
    gender: 'male' | 'female' | 'neutral';
    description: string;
    age: 'young' | 'middle' | 'mature';
}

// Turbo 2.5 compatible voices (standard ElevenLabs voices)
export const JAPANESE_VOICES: VoiceOption[] = [
    // Male voices
    {
        id: 'JBFqnCBvURuLQ7tpZoro',
        name: 'ジョージ',
        gender: 'male',
        description: '温かみのある男性声',
        age: 'middle',
    },
    {
        id: 'onw79q6M99uN7H3YqYy4',
        name: 'ダニエル',
        gender: 'male',
        description: '落ち着いた男性声',
        age: 'middle',
    },
    {
        id: 'IKne3meq5pSbhcnEsnGe',
        name: 'チャーリー',
        gender: 'male',
        description: 'カジュアルな男性声',
        age: 'young',
    },
    {
        id: 'N2lVS1wzLe9qybdD6Gaj',
        name: 'カラム',
        gender: 'male',
        description: '穏やかな男性声',
        age: 'young',
    },
    {
        id: 'TX380097OofM4HREp3y3',
        name: 'リアム',
        gender: 'male',
        description: '若い男性声',
        age: 'young',
    },
    // Female voices
    {
        id: '9BWts74D2G803CHClfkM',
        name: 'アリア',
        gender: 'female',
        description: '表現力豊かな女性声',
        age: 'young',
    },
    {
        id: 'EXAVVmYWIigS90r0O5qH',
        name: 'サラ',
        gender: 'female',
        description: '柔らかい女性声',
        age: 'young',
    },
    {
        id: 'cgSfsWEy7lMDi95EuSjn',
        name: 'シャーロット',
        gender: 'female',
        description: '落ち着いた女性声',
        age: 'middle',
    },
    {
        id: 'pFZP5JQG7iQjIQuC4Bku',
        name: 'リリー',
        gender: 'female',
        description: '明るい女性声',
        age: 'young',
    },
];

// Default voice (George GUID)
export const DEFAULT_VOICE_ID = 'JBFqnCBvURuLQ7tpZoro';

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
    const voice = JAPANESE_VOICES.find(v =>
        v.name.toLowerCase() === name.toLowerCase()
    );
    return voice?.id;
}
