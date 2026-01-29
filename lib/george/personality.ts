/**
 * George Personality Configuration
 * Users can customize George's gender, style, and voice
 */

export type Gender = 'male' | 'female' | 'neutral';
export type PersonalityStyle = 'gentle' | 'strict' | 'sarcastic';

export interface GeorgePersonality {
    name: string;
    gender: Gender;
    style: PersonalityStyle;
    voiceId: string;
}

// ElevenLabs voice mappings
export const VOICE_OPTIONS: Record<Gender, Record<PersonalityStyle, { id: string; name: string }>> = {
    male: {
        gentle: { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (穏やか)' },
        strict: { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel (威厳)' },
        sarcastic: { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum (皮肉)' },
    },
    female: {
        gentle: { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (優しい)' },
        strict: { id: 'jsCqWAovK2LkecY7zXl4', name: 'Freya (凛々しい)' },
        sarcastic: { id: 'oWAxZDx7w5VEj9dCyTzz', name: 'Grace (毒舌)' },
    },
    neutral: {
        gentle: { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (穏やか)' },
        strict: { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel (威厳)' },
        sarcastic: { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum (皮肉)' },
    },
};

// Default names by gender
export const DEFAULT_NAMES: Record<Gender, string> = {
    male: 'ジョージ',
    female: 'ジョージア',
    neutral: 'ジョージ',
};

// Personality style descriptions
export const STYLE_DESCRIPTIONS: Record<PersonalityStyle, string> = {
    gentle: '優しく寄り添う',
    strict: '厳しくも愛のある',
    sarcastic: '毒舌だけど的確',
};

// Get voice ID for personality
export function getVoiceId(gender: Gender, style: PersonalityStyle): string {
    return VOICE_OPTIONS[gender][style].id;
}

// Get default personality
export function getDefaultPersonality(): GeorgePersonality {
    return {
        name: 'ジョージ',
        gender: 'male',
        style: 'gentle',
        voiceId: VOICE_OPTIONS.male.gentle.id,
    };
}

// Save personality to localStorage
export function savePersonality(personality: GeorgePersonality): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem('george_personality', JSON.stringify(personality));
    }
}

// Load personality from localStorage
export function loadPersonality(): GeorgePersonality | null {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('george_personality');
        if (saved) {
            return JSON.parse(saved);
        }
    }
    return null;
}

// Check if onboarding is complete
export function isOnboardingComplete(): boolean {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('george_onboarding_complete') === 'true';
    }
    return false;
}

// Mark onboarding as complete
export function completeOnboarding(): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem('george_onboarding_complete', 'true');
    }
}
