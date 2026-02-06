import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const apiKey = process.env.DEEPGRAM_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Deepgram API key missing' }, { status: 500 });
        }

        const formData = await request.formData();
        const audioFile = formData.get('audio') as File;

        if (!audioFile) {
            return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
        }

        const audioBuffer = await audioFile.arrayBuffer();
        const rawContentType = (audioFile.type || '').toLowerCase();
        let contentType = 'application/octet-stream';
        if (rawContentType.startsWith('audio/webm')) contentType = 'audio/webm';
        else if (rawContentType.startsWith('audio/mp4') || rawContentType.startsWith('audio/m4a')) contentType = 'audio/mp4';
        else if (rawContentType.startsWith('audio/wav') || rawContentType.startsWith('audio/x-wav')) contentType = 'audio/wav';
        else if (rawContentType.startsWith('audio/ogg')) contentType = 'audio/ogg';
        else if (rawContentType.startsWith('audio/mpeg') || rawContentType.startsWith('audio/mp3')) contentType = 'audio/mpeg';
        const model = process.env.DEEPGRAM_STT_MODEL || process.env.NEXT_PUBLIC_DEEPGRAM_STT_MODEL || 'nova-2';
        const language = process.env.DEEPGRAM_STT_LANGUAGE || process.env.NEXT_PUBLIC_DEEPGRAM_STT_LANGUAGE || 'ja';
        const params = new URLSearchParams({
            model,
            language,
            smart_format: 'true',
            punctuate: 'true',
        });

        console.log(`[API/STT] Starting Deepgram transcription... rawType=${rawContentType || 'n/a'}, normalizedType=${contentType}, bytes=${audioBuffer.byteLength}`);
        const startTime = Date.now();

        const deepgramResponse = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
            method: 'POST',
            headers: {
                Authorization: `Token ${apiKey}`,
                'Content-Type': contentType,
            },
            body: audioBuffer,
        });

        if (!deepgramResponse.ok) {
            const errorText = await deepgramResponse.text();
            console.error(`[API/STT] Deepgram error: ${deepgramResponse.status} ${errorText}`);
            return NextResponse.json(
                {
                    error: 'Deepgram STT failed',
                    deepgramStatus: deepgramResponse.status,
                    details: errorText,
                },
                { status: deepgramResponse.status }
            );
        }

        const data = await deepgramResponse.json();
        const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim?.() || '';
        const duration = Date.now() - startTime;
        console.log(`[API/STT] Deepgram transcription complete: ${duration}ms, result="${transcript.substring(0, 50)}..."`);

        return NextResponse.json({ transcript });

    } catch (error) {
        console.error('[API/STT] error:', error);
        return NextResponse.json(
            { error: 'Failed to transcribe audio', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
