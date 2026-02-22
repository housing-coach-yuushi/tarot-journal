# george-stt-relay

Deepgram STT WebSocket relay for the tarot journal app.

## Purpose

Moves the Deepgram streaming WebSocket connection from the browser to Cloud Run:

- Browser -> `george-stt-relay` (WS)
- `george-stt-relay` -> Deepgram `v1/listen` (WS)

This avoids browser-specific WS auth / connection issues while keeping Deepgram `nova-3`.

## Local run

```bash
cd services/stt-relay
npm install
DEEPGRAM_API_KEY=your_key npm start
```

Health check:

```bash
curl http://localhost:8080/healthz
```

## Browser config (main app)

Set this in the main app environment:

```env
NEXT_PUBLIC_STT_RELAY_WS_URL=wss://YOUR-RELAY-URL/ws
```

The client sends PCM16 chunks and Deepgram control messages (`KeepAlive`, `Finalize`, `CloseStream`).

## Cloud Run deploy example

```bash
gcloud run deploy george-stt-relay \
  --source services/stt-relay \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars DEEPGRAM_API_KEY=YOUR_DEEPGRAM_API_KEY,DEEPGRAM_STT_MODEL=nova-3,DEEPGRAM_STT_LANGUAGE=ja \
  --timeout 300 \
  --min-instances 1
```

## Optional env vars

- `DEEPGRAM_STT_MODEL` (default: `nova-3`)
- `DEEPGRAM_STT_LANGUAGE` (default: `ja`)
- `DEEPGRAM_RELAY_KEEPALIVE_MS` (default: `4000`)
- `STT_RELAY_ALLOWED_ORIGINS` (comma-separated exact origins)

