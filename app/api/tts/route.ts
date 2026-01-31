import { NextRequest, NextResponse } from 'next/server';
import { getKieApiClient } from '@/lib/keiapi/client';
import { loadIdentity } from '@/lib/clawdbot/bootstrap';
import { DEFAULT_VOICE_ID, getVoiceById } from '@/lib/tts/voices';

export async function POST(request: NextRequest) {
    let text = '';
    let voiceId = '';
    let voiceName = 'George';

    try {
        const body = await request.json();
        text = body.text;
        const requestVoiceId = body.voiceId;

        console.log(`[API/TTS] Incoming request: text="${text?.substring(0, 20)}...", voiceId=${requestVoiceId}`);

        if (!text) {
            return NextResponse.json(
                { error: 'Text is required' },
                { status: 400 }
            );
        }

        // Get voice ID from request, AI identity, or use default
        voiceId = requestVoiceId;
        if (!voiceId) {
            const identity = await loadIdentity();
            voiceId = identity?.voiceId || DEFAULT_VOICE_ID;
        }
        // Resolve voice name for Kie.ai API (it expects name, not ID/UUID)
        const voiceOption = getVoiceById(voiceId);
        voiceName = voiceOption?.name || 'George';

        console.log(`[API/TTS] Process start: textLength=${text.length}, voiceId=${voiceId}, voiceName=${voiceName}`);

        const startTime = Date.now();
        const client = getKieApiClient();

        // Get audio URL from Kie.ai TTS with the selected voice name
        const audioUrl = await client.textToSpeech(text, voiceName);
        const duration = Date.now() - startTime;
        console.log(`[API/TTS] Kie.ai success: duration=${duration}ms, url=${audioUrl}`);

        // Fetch the audio file
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) {
            console.error(`[API/TTS] Audio fetch failed: ${audioResponse.status}`);
            throw new Error('Failed to fetch audio from generated URL');
        }

        const audioBuffer = await audioResponse.arrayBuffer();
        console.log(`[API/TTS] Process complete: size=${audioBuffer.byteLength} bytes`);

        return new NextResponse(audioBuffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioBuffer.byteLength.toString(),
            },
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('TTS API Error Detail:', {
            message: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
            textSnippet: text?.substring(0, 50),
            voiceId: voiceId,
            voiceName: voiceName
        });
        return NextResponse.json(
            { error: 'Failed to generate speech', details: errorMessage },
            { status: 500 }
        );
    }
}
