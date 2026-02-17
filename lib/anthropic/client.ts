export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
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
            // Subscriptions often work on coding endpoints, so prefer them first.
            'https://api.z.ai/api/coding/paas/v4',
            'https://open.bigmodel.cn/api/coding/paas/v4',
            'https://api.z.ai/api/paas/v4',
            'https://open.bigmodel.cn/api/paas/v4',
        ]);

    return { apiKey, model, baseUrls };
}

function extractMessageContent(message: unknown): string {
    if (typeof message === 'string') {
        return message;
    }
    if (Array.isArray(message)) {
        const merged = message
            .filter((part: unknown): part is { type?: string; text?: string } => typeof part === 'object' && part !== null)
            .map((part) => (part.type === 'text' && typeof part.text === 'string') ? part.text : '')
            .join('')
            .trim();
        if (merged) {
            return merged;
        }
    }
    return '';
}

export async function chatWithClaude(messages: ChatMessage[], model?: string) {
    const runtime = await resolveGlmRuntime(model);
    const selectedModel = runtime.model;
    const failures: string[] = [];

    for (const baseUrl of runtime.baseUrls) {
        const endpoint = `${baseUrl}/chat/completions`;
        console.log(`[GLM] Trying direct endpoint: ${endpoint} (model=${selectedModel})`);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${runtime.apiKey}`,
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

            const text = extractMessageContent(data?.choices?.[0]?.message?.content).trim();
            if (text) {
                return text;
            }

            failures.push(`${endpoint} -> empty content`);
        } catch (error) {
            failures.push(`${endpoint} -> ${(error as Error).message}`);
        }
    }

    throw new Error(`GLM direct API failed. ${failures.join(' | ')}`);
}
