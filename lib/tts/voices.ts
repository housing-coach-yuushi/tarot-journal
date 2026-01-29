/**
 * Available Japanese TTS voices from ElevenLabs via Kie.ai
 */

export interface VoiceOption {
    id: string;
    name: string;
    gender: 'male' | 'female' | 'neutral';
    description: string;
    age: 'young' | 'middle' | 'mature';
}

// Japanese voices from ElevenLabs (curated list)
export const JAPANESE_VOICES: VoiceOption[] = [
    // Male voices
    {
        id: 'wAWUBOIVEUw9IEUYoNzR',
        name: 'Junichi',
        gender: 'male',
        description: '中年男性、落ち着いたバリトン',
        age: 'middle',
    },
    {
        id: 'Mv8AjrYZCBkdsmDHNwcB',
        name: 'Ishibashi',
        gender: 'male',
        description: '東京方言、力強く深い声',
        age: 'mature',
    },
    {
        id: 'bqpOyYNUu11tjjvRUbKn',
        name: 'Yamato',
        gender: 'male',
        description: '20〜30代の若い男性声',
        age: 'young',
    },
    {
        id: 'b34JylakFZPlGS0BnwyY',
        name: 'Kenzo',
        gender: 'male',
        description: '落ち着いた専門的な男性声',
        age: 'middle',
    },
    {
        id: '5enpi03fjGAwd9rnMfVT',
        name: 'Noguchi',
        gender: 'male',
        description: '若い男性、穏やかな声',
        age: 'young',
    },
    {
        id: 'GKDaBI8TKSBJVhsCLD6n',
        name: 'Asahi',
        gender: 'male',
        description: '若い男性、落ち着いた会話向け',
        age: 'young',
    },
    {
        id: 'LNzr3u01PIEDg0fRlvE7',
        name: 'Ichiro',
        gender: 'male',
        description: '若い男性、穏やかな声',
        age: 'young',
    },
    {
        id: 'pNInz6obpgDQGcFmaJgB',
        name: 'Adam',
        gender: 'male',
        description: 'デフォルト男性声（多言語対応）',
        age: 'middle',
    },
    // Female voices
    {
        id: '8EkOjt4xTPGMclNlh1pk',
        name: 'Morioki',
        gender: 'female',
        description: '会話向けの女性声',
        age: 'young',
    },
    {
        id: 'RBnMinrYKeccY3vaUxlZ',
        name: 'Sakura',
        gender: 'female',
        description: '若い女性、ポッドキャスト向け',
        age: 'young',
    },
    // Neutral
    {
        id: '8kS8nwk1TQdxvQOmfTZA',
        name: 'Ena',
        gender: 'neutral',
        description: '中性的な声',
        age: 'young',
    },
];

// Default voice for new AI (George's original voice)
export const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Adam

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
