import { NextRequest, NextResponse } from 'next/server';
import { getKieApiClient } from '@/lib/keiapi/client';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const audioFile = formData.get('audio') as File;

        if (!audioFile) {
            return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
        }

        // Convert file to base64
        const buffer = await audioFile.arrayBuffer();
        const base64Audio = Buffer.from(buffer).toString('base64');
        const mimeType = audioFile.type || 'audio/mp4';

        const client = getKieApiClient();

        console.log(`[API/STT] Starting Speech-to-Text transcription... mimeType=${mimeType}`);
        const startTime = Date.now();

        let transcript: string;
        try {
            transcript = await client.speechToText(base64Audio, mimeType);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes('model name you specified is not supported')) {
                const fallbackModel = process.env.KEIAPI_STT_FALLBACK_MODEL || 'elevenlabs/scribe-v2';
                const fallbackInputMode = (process.env.KEIAPI_STT_FALLBACK_INPUT_MODE as 'audio_url' | 'audio' | undefined) || 'audio';
                console.warn(`[API/STT] Primary model unsupported. Retrying with fallback model: ${fallbackModel}`);
                transcript = await client.speechToText(base64Audio, mimeType, {
                    model: fallbackModel,
                    inputMode: fallbackInputMode,
                });
            } else {
                throw error;
            }
        }

        const duration = Date.now() - startTime;
        console.log(`[API/STT] Transcription complete: ${duration}ms, result="${transcript.substring(0, 50)}..."`);

        return NextResponse.json({ transcript });

    } catch (error) {
        console.error('[API/STT] error:', error);
        return NextResponse.json(
            { error: 'Failed to transcribe audio', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
