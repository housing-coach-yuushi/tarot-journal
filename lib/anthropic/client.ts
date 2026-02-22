import { getKieApiClient } from '@/lib/keiapi/client';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

function joinTextParts(parts: unknown): string {
    if (!Array.isArray(parts)) return '';
    return parts
        .map((part) => {
            if (!part || typeof part !== 'object') return '';
            const text = (part as { text?: unknown }).text;
            return typeof text === 'string' ? text : '';
        })
        .join('')
        .trim();
}

interface GeminiGenerateContentResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{ text?: string }>;
        };
    }>;
    promptFeedback?: {
        blockReason?: string;
    };
    error?: {
        message?: string;
    };
}

function toGeminiContents(messages: ChatMessage[]) {
    const systemLines: string[] = [];
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const message of messages) {
        const text = (message.content || '').trim();
        if (!text) continue;

        if (message.role === 'system') {
            systemLines.push(text);
            continue;
        }

        const role: 'user' | 'model' = message.role === 'assistant' ? 'model' : 'user';
        const prev = contents[contents.length - 1];
        if (prev && prev.role === role) {
            prev.parts.push({ text });
        } else {
            contents.push({ role, parts: [{ text }] });
        }
    }

    // Gemini can reject conversations that begin with model-only context.
    if (contents[0]?.role === 'model') {
        const first = contents.shift();
        if (first) {
            contents.unshift({
                role: 'user',
                parts: [{ text: `以下は直前のAI応答の文脈です。続けて会話してください。\n${joinTextParts(first.parts)}` }],
            });
        }
    }

    return {
        systemInstructionText: systemLines.join('\n\n').trim(),
        contents,
    };
}

function resolveGoogleRuntime(modelOverride?: string) {
    const apiKey = (
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.GOOGLE_AI_STUDIO_API_KEY
    )?.trim();

    if (!apiKey) return null;

    const model = (modelOverride || process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
    const baseUrl = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
    const apiVersion = (process.env.GEMINI_API_VERSION || 'v1beta').trim();
    return { apiKey, model, baseUrl, apiVersion };
}

async function chatWithGoogleGemini(messages: ChatMessage[], modelOverride?: string): Promise<string> {
    const runtime = resolveGoogleRuntime(modelOverride);
    if (!runtime) {
        throw new Error('Gemini API key is not configured');
    }

    const { systemInstructionText, contents } = toGeminiContents(messages);
    const endpoint = `${runtime.baseUrl}/${runtime.apiVersion}/models/${encodeURIComponent(runtime.model)}:generateContent`;
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': runtime.apiKey,
        },
        body: JSON.stringify({
            ...(systemInstructionText
                ? { systemInstruction: { parts: [{ text: systemInstructionText }] } }
                : {}),
            contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: 'こんにちは' }] }],
            generationConfig: {
                temperature: 0.7,
                topP: 0.9,
                maxOutputTokens: 512,
            },
        }),
    });

    const rawText = await response.text();
    let data: GeminiGenerateContentResponse | null = null;
    try {
        data = rawText ? JSON.parse(rawText) as GeminiGenerateContentResponse : null;
    } catch {
        // keep rawText for diagnostics below
    }

    if (!response.ok) {
        const apiMessage = data?.error?.message || rawText || `HTTP ${response.status}`;
        throw new Error(`Gemini API Error: ${response.status} - ${String(apiMessage).slice(0, 500)}`);
    }

    const text = (
        data?.candidates?.map((candidate) => joinTextParts(candidate?.content?.parts)).find((v) => v) ||
        ''
    ).trim();

    if (text) return text;

    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) {
        throw new Error(`Gemini blocked response: ${blockReason}`);
    }

    throw new Error(`Gemini returned empty content: ${rawText.slice(0, 500)}`);
}

async function chatWithKieGemini(messages: ChatMessage[], modelOverride?: string): Promise<string> {
    const client = getKieApiClient();
    const model = (modelOverride || process.env.KIE_GEMINI_MODEL || 'gemini-3-flash').trim();
    return client.chat(messages, model);
}

type GlmRuntime = {
    apiKey: string;
    model: string;
    baseUrls: string[];
};

function normalizeModelId(input: string): string {
    const model = input.trim();
    if (!model) return 'glm-5';
    return model.startsWith('zai/') ? model.slice(4) : model;
}

function uniqueUrls(urls: string[]): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const url of urls.map((v) => v.trim()).filter(Boolean)) {
        const key = url.replace(/\/$/, '');
        if (!seen.has(key)) {
            seen.add(key);
            out.push(key);
        }
    }
    return out;
}

async function resolveGlmRuntime(modelOverride?: string): Promise<GlmRuntime> {
    const model = normalizeModelId(modelOverride || process.env.GLM_MODEL || process.env.OPENCLAW_MODEL || 'glm-5');
    const apiKey = process.env.ZAI_API_KEY;
    if (!apiKey) {
        throw new Error('ZAI_API_KEY is not configured');
    }

    const explicitBaseUrl = (process.env.ZAI_API_BASE_URL || '').trim();
    const baseUrls = explicitBaseUrl
        ? [explicitBaseUrl]
        : uniqueUrls([
            'https://api.z.ai/api/coding/paas/v4',
            'https://open.bigmodel.cn/api/coding/paas/v4',
            'https://api.z.ai/api/paas/v4',
            'https://open.bigmodel.cn/api/paas/v4',
        ]);

    return { apiKey, model, baseUrls };
}

function extractGlmMessageContent(message: unknown): string {
    if (typeof message === 'string') {
        return message;
    }
    if (Array.isArray(message)) {
        const merged = message
            .filter((part: unknown): part is { type?: string; text?: string } => typeof part === 'object' && part !== null)
            .map((part) => (part.type === 'text' && typeof part.text === 'string') ? part.text : '')
            .join('')
            .trim();
        if (merged) return merged;
    }
    return '';
}

async function chatWithLegacyGlm(messages: ChatMessage[], model?: string) {
    const runtime = await resolveGlmRuntime(model);
    const selectedModel = runtime.model;
    const failures: string[] = [];

    for (const baseUrl of runtime.baseUrls) {
        const endpoint = `${baseUrl}/chat/completions`;
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${runtime.apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept-Language': 'ja-JP,ja',
                },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: messages.map((message) => ({
                        role: message.role,
                        content: message.content,
                    })),
                    stream: false,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                failures.push(`${endpoint} -> ${response.status}: ${errorText.slice(0, 220)}`);
                continue;
            }

            const data = await response.json();
            if (data?.error) {
                failures.push(`${endpoint} -> API error: ${JSON.stringify(data.error).slice(0, 220)}`);
                continue;
            }

            const text = extractGlmMessageContent(data?.choices?.[0]?.message?.content).trim();
            if (text) return text;
            failures.push(`${endpoint} -> empty content`);
        } catch (error) {
            failures.push(`${endpoint} -> ${(error as Error).message}`);
        }
    }

    throw new Error(`GLM direct API failed. ${failures.join(' | ')}`);
}

export async function chatWithClaude(messages: ChatMessage[], model?: string) {
    const failures: string[] = [];

    // 1) Google AI Studio / Gemini direct (preferred for low-latency chat)
    try {
        return await chatWithGoogleGemini(messages, model);
    } catch (error) {
        failures.push(`gemini-direct: ${(error as Error).message}`);
    }

    // 2) KIE Gemini fallback (if KEIAPI_KEY is configured)
    try {
        return await chatWithKieGemini(messages, model);
    } catch (error) {
        failures.push(`kie-gemini: ${(error as Error).message}`);
    }

    // 3) Legacy GLM fallback
    try {
        return await chatWithLegacyGlm(messages, model);
    } catch (error) {
        failures.push(`glm: ${(error as Error).message}`);
    }

    throw new Error(`All chat providers failed. ${failures.join(' | ')}`);
}
