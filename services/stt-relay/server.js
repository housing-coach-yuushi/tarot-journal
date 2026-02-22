const http = require('http');
const { URL } = require('url');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT || 8080);
const DEEPGRAM_API_KEY = (process.env.DEEPGRAM_API_KEY || '').trim();
const DEFAULT_MODEL = (process.env.DEEPGRAM_STT_MODEL || 'nova-3').trim();
const DEFAULT_LANGUAGE = (process.env.DEEPGRAM_STT_LANGUAGE || 'ja').trim();
const KEEPALIVE_MS = Number(process.env.DEEPGRAM_RELAY_KEEPALIVE_MS || 4000);
const ALLOWED_ORIGINS = (process.env.STT_RELAY_ALLOWED_ORIGINS || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

function log(...args) {
  console.log(new Date().toISOString(), '[stt-relay]', ...args);
}

function isOriginAllowed(origin) {
  if (!ALLOWED_ORIGINS.length) return true;
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

function safeClose(ws, code, reason) {
  if (!ws) return;
  try {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close(code, reason);
    }
  } catch {
    // no-op
  }
}

function buildDeepgramUrl(reqUrl) {
  const requestUrl = new URL(reqUrl, 'http://localhost');
  const dgUrl = new URL('wss://api.deepgram.com/v1/listen');

  const model = (requestUrl.searchParams.get('model') || DEFAULT_MODEL).trim();
  const language = (requestUrl.searchParams.get('language') || DEFAULT_LANGUAGE).trim();
  const encoding = (requestUrl.searchParams.get('encoding') || 'linear16').trim();
  const sampleRate = (requestUrl.searchParams.get('sample_rate') || '16000').trim();
  const channels = (requestUrl.searchParams.get('channels') || '1').trim();
  const endpointing = (requestUrl.searchParams.get('endpointing') || 'false').trim();
  const interimResults = (requestUrl.searchParams.get('interim_results') || 'true').trim();
  const vadEvents = (requestUrl.searchParams.get('vad_events') || 'true').trim();
  const smartFormat = (requestUrl.searchParams.get('smart_format') || 'true').trim();
  const punctuate = (requestUrl.searchParams.get('punctuate') || 'true').trim();

  dgUrl.searchParams.set('model', model);
  dgUrl.searchParams.set('language', language);
  dgUrl.searchParams.set('encoding', encoding);
  dgUrl.searchParams.set('sample_rate', sampleRate);
  dgUrl.searchParams.set('channels', channels);
  dgUrl.searchParams.set('endpointing', endpointing);
  dgUrl.searchParams.set('interim_results', interimResults);
  dgUrl.searchParams.set('vad_events', vadEvents);
  dgUrl.searchParams.set('smart_format', smartFormat);
  dgUrl.searchParams.set('punctuate', punctuate);

  return dgUrl;
}

if (!DEEPGRAM_API_KEY) {
  log('WARNING: DEEPGRAM_API_KEY is not set. Relay will reject websocket connections.');
}

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'george-stt-relay' }));
    return;
  }

  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('george-stt-relay\n');
});

const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

wss.on('connection', (client, req) => {
  if (!DEEPGRAM_API_KEY) {
    client.send(JSON.stringify({ type: 'error', code: 'config', detail: 'DEEPGRAM_API_KEY missing' }));
    safeClose(client, 1011, 'server-misconfig');
    return;
  }

  const clientIp = req.socket.remoteAddress || 'unknown';
  const dgUrl = buildDeepgramUrl(req.url || '/');
  log('client connected', clientIp, '->', dgUrl.toString().replace(DEEPGRAM_API_KEY, '[redacted]'));

  const deepgram = new WebSocket(dgUrl, {
    headers: {
      Authorization: `Token ${DEEPGRAM_API_KEY}`,
    },
    perMessageDeflate: false,
  });

  const pending = [];
  let deepgramOpen = false;
  let closing = false;
  let keepAliveTimer = null;
  let clientBinaryChunks = 0;
  let clientBinaryBytes = 0;
  let deepgramResultCount = 0;

  const clearKeepAlive = () => {
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
  };

  const closeBoth = (reason) => {
    if (closing) return;
    closing = true;
    clearKeepAlive();
    safeClose(client, 1000, reason || 'closing');
    safeClose(deepgram, 1000, reason || 'closing');
  };

  const forwardToDeepgram = (data, isBinary) => {
    if (deepgram.readyState !== WebSocket.OPEN) {
      pending.push({ data, isBinary });
      return;
    }
    try {
      deepgram.send(data, { binary: isBinary });
    } catch (error) {
      log('forwardToDeepgram error', error instanceof Error ? error.message : String(error));
      client.send(JSON.stringify({ type: 'error', code: 'relay-send', detail: 'failed to forward audio/control to deepgram' }));
      closeBoth('relay-send-error');
    }
  };

  deepgram.on('open', () => {
    deepgramOpen = true;
    log('deepgram open', clientIp);
    while (pending.length) {
      const item = pending.shift();
      if (!item) break;
      forwardToDeepgram(item.data, item.isBinary);
    }

    keepAliveTimer = setInterval(() => {
      if (deepgram.readyState !== WebSocket.OPEN || closing) return;
      try {
        deepgram.send(JSON.stringify({ type: 'KeepAlive' }));
      } catch {
        // ignore
      }
    }, KEEPALIVE_MS);

    try {
      client.send(JSON.stringify({ type: 'RelayReady' }));
    } catch {
      // no-op
    }
  });

  deepgram.on('message', (data, isBinary) => {
    if (!isBinary) {
      try {
        const text = typeof data === 'string' ? data : data.toString('utf8');
        const parsed = JSON.parse(text);
        const type = parsed?.type || 'unknown';
        if (type === 'Results') {
          deepgramResultCount += 1;
          const transcript = parsed?.channel?.alternatives?.[0]?.transcript || '';
          if (transcript) {
            log('deepgram result', clientIp, `final=${Boolean(parsed?.is_final)}`, `speechFinal=${Boolean(parsed?.speech_final)}`, `len=${String(transcript).length}`);
          }
        } else if (type === 'Error') {
          log('deepgram message error', clientIp, text.slice(0, 300));
        } else if (type !== 'Metadata' && type !== 'UtteranceEnd') {
          log('deepgram message', clientIp, `type=${type}`);
        }
      } catch {
        // ignore parse failures for logging only
      }
    }
    if (client.readyState !== WebSocket.OPEN) return;
    try {
      client.send(data, { binary: Boolean(isBinary) });
    } catch (error) {
      log('forwardToClient error', error instanceof Error ? error.message : String(error));
      closeBoth('client-send-error');
    }
  });

  deepgram.on('error', (error) => {
    log('deepgram error', clientIp, error instanceof Error ? error.message : String(error));
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify({ type: 'error', code: 'deepgram-ws', detail: error instanceof Error ? error.message : String(error) }));
      } catch {
        // no-op
      }
    }
  });

  deepgram.on('close', (code, reasonBuffer) => {
    const reason = Buffer.isBuffer(reasonBuffer) ? reasonBuffer.toString('utf8') : String(reasonBuffer || '');
    clearKeepAlive();
    log(
      'deepgram close',
      clientIp,
      `code=${code}`,
      `reason=${reason || 'n/a'}`,
      `clientChunks=${clientBinaryChunks}`,
      `clientBytes=${clientBinaryBytes}`,
      `results=${deepgramResultCount}`,
    );
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify({ type: 'RelayClose', code, reason }));
      } catch {
        // no-op
      }
      const closeCode = typeof code === 'number' && code >= 1000 && code <= 4999 ? code : 1011;
      safeClose(client, closeCode, reason || 'deepgram-close');
    }
  });

  client.on('message', (data, isBinary) => {
    if (closing) return;
    if (isBinary) {
      clientBinaryChunks += 1;
      clientBinaryBytes += Buffer.byteLength(data);
      if (clientBinaryChunks === 1 || clientBinaryChunks % 50 === 0) {
        log('client audio', clientIp, `chunks=${clientBinaryChunks}`, `bytes=${clientBinaryBytes}`);
      }
      forwardToDeepgram(data, true);
      return;
    }

    const text = typeof data === 'string' ? data : data.toString('utf8');
    if (!text) return;

    // Allow pass-through of Deepgram control messages (Finalize/CloseStream/KeepAlive)
    // and optional relay control messages.
    try {
      const parsed = JSON.parse(text);
      if (parsed && parsed.type === 'close') {
        closeBoth('client-close');
        return;
      }
      if (parsed && parsed.type === 'finalize') {
        forwardToDeepgram(JSON.stringify({ type: 'Finalize' }), false);
        return;
      }
      if (parsed && parsed.type === 'ping') {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'pong' }));
        }
        return;
      }
    } catch {
      // Non-JSON text is forwarded as-is below.
    }

    forwardToDeepgram(text, false);
  });

  client.on('close', (code, reasonBuffer) => {
    const reason = Buffer.isBuffer(reasonBuffer) ? reasonBuffer.toString('utf8') : String(reasonBuffer || '');
    log('client close', clientIp, `code=${code}`, `reason=${reason || 'n/a'}`, `dgOpen=${deepgramOpen}`);
    clearKeepAlive();
    safeClose(deepgram, 1000, 'client-close');
  });

  client.on('error', (error) => {
    log('client error', clientIp, error instanceof Error ? error.message : String(error));
    clearKeepAlive();
    safeClose(deepgram, 1011, 'client-error');
  });
});

server.on('upgrade', (req, socket, head) => {
  const origin = req.headers.origin || '';
  if (!isOriginAllowed(origin)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }

  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  if (pathname !== '/ws') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

server.listen(PORT, () => {
  log(`listening on :${PORT}`);
});
