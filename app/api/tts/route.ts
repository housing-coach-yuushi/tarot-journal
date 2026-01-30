import { NextRequest, NextResponse } from 'next/server';
import { getKieApiClient } from '@/lib/keiapi/client';
import { loadIdentity } from '@/lib/clawdbot/bootstrap';
import { DEFAULT_VOICE_ID } from '@/lib/tts/voices';

export async function POST(request: NextRequest) {
    try {
        const { text, voiceId: requestVoiceId } = await request.json();
        console.log(`[API/TTS] Incoming request: text="${text?.substring(0, 20)}...", voiceId=${requestVoiceId}`);

        if (!text) {
            return NextResponse.json(
                { error: 'Text is required' },
                { status: 400 }
            );
        }

        // Get voice ID from request, AI identity, or use default
        let voiceId = requestVoiceId;
        if (!voiceId) {
            const identity = await loadIdentity();
            voiceId = identity?.voiceId || DEFAULT_VOICE_ID;
        }

        const client = getKieApiClient();

        // Get audio URL from Kie.ai TTS with the selected voice
        const audioUrl = await client.textToSpeech(text, voiceId);

        // Fetch the audio file
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) {
            throw new Error('Failed to fetch audio');
        }

        const audioBuffer = await audioResponse.arrayBuffer();

        return new NextResponse(audioBuffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioBuffer.byteLength.toString(),
            },
        });

    } catch (error) {
        console.error('TTS API Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate speech' },
            { status: 500 }
        );
    }
}
