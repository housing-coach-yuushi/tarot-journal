import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const relayWsUrl = (
    process.env.STT_RELAY_WS_URL ||
    process.env.NEXT_PUBLIC_STT_RELAY_WS_URL ||
    ''
  ).trim();

  return NextResponse.json(
    { relayWsUrl },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    },
  );
}
