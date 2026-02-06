#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[predeploy] 1/4 TypeScript typecheck"
npx tsc --noEmit --pretty false

if [ -z "${DEEPGRAM_API_KEY:-}" ] && [ -f ".env.local" ]; then
  # shellcheck disable=SC1091
  set -a
  source .env.local
  set +a
fi

if [ -z "${DEEPGRAM_API_KEY:-}" ]; then
  echo "[predeploy] DEEPGRAM_API_KEY is missing"
  exit 1
fi

SAMPLE_WAV="/tmp/dg_predeploy_sample.wav"
if [ ! -s "$SAMPLE_WAV" ]; then
  echo "[predeploy] Downloading STT sample audio"
  curl -fsSL -o "$SAMPLE_WAV" "https://static.deepgram.com/examples/Bueller-Life-moves-pretty-fast.wav"
fi

echo "[predeploy] 2/4 Deepgram STT direct check"
STT_CODE="$(curl -sS -o /tmp/dg_predeploy_stt.json -w "%{http_code}" -X POST \
  -H "Authorization: Token $DEEPGRAM_API_KEY" \
  -H "content-type: audio/wav" \
  --data-binary @"$SAMPLE_WAV" \
  "https://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true&punctuate=true")"

if [ "$STT_CODE" != "200" ]; then
  echo "[predeploy] STT failed: HTTP $STT_CODE"
  cat /tmp/dg_predeploy_stt.json
  exit 1
fi

python3 - <<'PY'
import json

data = json.load(open('/tmp/dg_predeploy_stt.json'))
alt = data.get('results', {}).get('channels', [{}])[0].get('alternatives', [{}])[0]
text = (alt.get('transcript') or '').strip()
if not text:
    raise SystemExit('[predeploy] STT failed: transcript is empty')
print(f'[predeploy] STT ok: {len(text)} chars')
PY

echo "[predeploy] 3/4 Deepgram TTS direct check"
TTS_CODE="$(curl -sS -D /tmp/dg_predeploy_tts_headers.txt -o /tmp/dg_predeploy_tts.mp3 -w "%{http_code}" -X POST \
  -H "Authorization: Token $DEEPGRAM_API_KEY" \
  -H "content-type: application/json" \
  -d '{"text":"テスト音声です。デプロイ前チェックです。"}' \
  "https://api.deepgram.com/v1/speak?model=aura-2-izanami-ja&encoding=mp3")"

if [ "$TTS_CODE" != "200" ]; then
  echo "[predeploy] TTS failed: HTTP $TTS_CODE"
  cat /tmp/dg_predeploy_tts_headers.txt
  exit 1
fi

TTS_BYTES="$(wc -c < /tmp/dg_predeploy_tts.mp3)"
if [ "$TTS_BYTES" -lt 1024 ]; then
  echo "[predeploy] TTS failed: output too small (${TTS_BYTES} bytes)"
  exit 1
fi

echo "[predeploy] TTS ok: ${TTS_BYTES} bytes"
echo "[predeploy] 4/4 Done"
