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

        const client = getKieApiClient();

        console.log('[API/STT] Starting ElevenLabs Scribe v2 transcription...');
        const startTime = Date.now();

        const transcript = await client.speechToText(base64Audio);

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
