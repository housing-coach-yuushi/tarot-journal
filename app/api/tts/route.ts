import { NextRequest, NextResponse } from 'next/server';
import { loadIdentity } from '@/lib/clawdbot/bootstrap';
import { DEFAULT_VOICE_ID, getVoiceById } from '@/lib/tts/voices';

export async function POST(request: NextRequest) {
    let text = '';
    let voiceId = '';

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

        // Stability-first: pin conversation TTS to one Japanese male voice.
        voiceId = DEFAULT_VOICE_ID;
        if (requestVoiceId && requestVoiceId !== DEFAULT_VOICE_ID) {
            console.log(`[API/TTS] Ignoring requested voiceId=${requestVoiceId}; using fixed voice=${DEFAULT_VOICE_ID}`);
        } else if (!requestVoiceId) {
            const identity = await loadIdentity();
            if (identity?.voiceId && identity.voiceId !== DEFAULT_VOICE_ID) {
                console.log(`[API/TTS] Ignoring identity voiceId=${identity.voiceId}; using fixed voice=${DEFAULT_VOICE_ID}`);
            }
        }
        // Resolve voice model for Deepgram
        const voiceOption = getVoiceById(voiceId);
        if (!voiceOption) {
            return NextResponse.json(
                { error: '無効な声IDです' },
                { status: 400 }
            );
        }

        const apiKey = process.env.DEEPGRAM_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'Deepgram API key missing' },
                { status: 500 }
            );
        }

        const encoding = process.env.DEEPGRAM_TTS_ENCODING || 'mp3';
        const sampleRate = Number(process.env.DEEPGRAM_TTS_SAMPLE_RATE || process.env.NEXT_PUBLIC_DEEPGRAM_TTS_SAMPLE_RATE || '');
        const params = new URLSearchParams({
            model: voiceId,
            encoding,
        });
        if (Number.isFinite(sampleRate) && sampleRate > 0) {
            params.set('sample_rate', String(sampleRate));
        }

        console.log(`[API/TTS] Process start: textLength=${text.length}, voiceId=${voiceId}, model=${voiceId}`);

        const startTime = Date.now();
        const deepgramResponse = await fetch(`https://api.deepgram.com/v1/speak?${params.toString()}`, {
            method: 'POST',
            headers: {
                Authorization: `Token ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
        });

        if (!deepgramResponse.ok) {
            const errorText = await deepgramResponse.text();
            console.error(`[API/TTS] Deepgram error: ${deepgramResponse.status} ${errorText}`);
            throw new Error(`Deepgram TTS Error: ${deepgramResponse.status} - ${errorText}`);
        }

        const audioBuffer = await deepgramResponse.arrayBuffer();
        const duration = Date.now() - startTime;
        console.log(`[API/TTS] Deepgram success: duration=${duration}ms, size=${audioBuffer.byteLength} bytes`);

        const contentType = deepgramResponse.headers.get('content-type') || 'audio/mpeg';
        return new NextResponse(audioBuffer, {
            headers: {
                'Content-Type': contentType,
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
        });
        return NextResponse.json(
            { error: 'Failed to generate speech', details: errorMessage },
            { status: 500 }
        );
    }
}
