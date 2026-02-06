import { NextResponse } from 'next/server';

const DEFAULT_TTL_SECONDS = 60;

export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'DEEPGRAM_API_KEY is missing' }, { status: 500 });
  }

  try {
    const ttlSeconds = Number(process.env.DEEPGRAM_TOKEN_TTL_SECONDS || DEFAULT_TTL_SECONDS);
    const response = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl_seconds: Number.isFinite(ttlSeconds) ? ttlSeconds : DEFAULT_TTL_SECONDS }),
    });

    const text = await response.text();
    if (!response.ok) {
      return NextResponse.json({ error: 'Deepgram token error', details: text }, { status: 500 });
    }

    try {
      const data = JSON.parse(text);
      if (!data?.access_token) {
        return NextResponse.json({ error: 'Deepgram token response missing access_token' }, { status: 500 });
      }
      return NextResponse.json({ access_token: data.access_token, expires_in: data.expires_in });
    } catch (error) {
      return NextResponse.json({ error: 'Deepgram token parse error', details: text }, { status: 500 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Deepgram token request failed', details: message }, { status: 500 });
  }
}
