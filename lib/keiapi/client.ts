/**
 * Kie.ai API Client
 * Supports both OpenAI-compatible chat endpoints and task-based APIs
 */

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface ChatCompletionResponse {
    choices: Array<{
        message: {
            role: string;
            content: string;
        };
    }>;
}

interface TaskResponse {
    code: number;
    message: string;
    data: {
        taskId: string;
    };
}

interface TaskStatusResponse {
    code: number;
    data: {
        state: 'waiting' | 'queuing' | 'generating' | 'success' | 'fail';
        resultJson?: string;
        failCode?: string;
        failMsg?: string;
    };
}

class KieApiClient {
    private apiKey: string;
    private baseUrl = 'https://api.kie.ai';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    /**
     * Chat completion using OpenAI-compatible endpoint
     * For models like Gemini, the model name is often in the URL path for this provider
     */
    async chat(messages: ChatMessage[], model: string = 'gemini-3-pro'): Promise<string> {
        const endpoint = `${this.baseUrl}/${model}/v1/chat/completions`;

        console.log(`Calling Kie AI Chat: ${endpoint}`);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: messages.map(m => ({
                    role: m.role,
                    content: m.content,
                })),
                stream: false,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`Kie.ai Chat API Error (${response.status}):`, error);
            throw new Error(`Kie.ai API Error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        console.log('--- KIE AI CHAT FULL RESPONSE ---\n', JSON.stringify(data, null, 2), '\n--- END ---');

        // Handle Kie.ai specific error codes in JSON
        if (data.code && data.code !== 200 && data.code !== 0) {
            throw new Error(`Kie.ai API Server Error: [Code ${data.code}] ${data.msg || 'Unknown server error'}`);
        }

        const content = data.choices?.[0]?.message?.content || '';
        if (!content && messages.length > 0) {
            console.warn('Kie.ai returned empty content despite no explicit error code.');
        }
        return content;
    }

    /**
     * Create a task for async APIs (TTS, image generation, etc.)
     */
    async createTask(model: string, input: object): Promise<string> {
        const endpoint = `${this.baseUrl}/api/v1/jobs/createTask`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                input,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 402) {
                throw new Error(`Kie.ai APIクレジット不足または支払いが必要です (HTTP 402)`);
            } else if (response.status === 401) {
                throw new Error(`Kie.ai APIキーが無効です (HTTP 401)`);
            }
            throw new Error(`Kie.ai Task API Http Error: ${response.status} - ${errorText}`);
        }

        const data: TaskResponse = await response.json();
        if (data.code !== 200) {
            throw new Error(`Kie.ai createTask Error: [Code ${data.code}] ${data.message || 'No message'} (JSON: ${JSON.stringify(data)})`);
        }

        if (!data.data?.taskId) {
            throw new Error(`Kie.ai createTask Error: No taskId returned in response data (JSON: ${JSON.stringify(data)})`);
        }

        return data.data.taskId;
    }

    /**
     * Query task status using recordInfo endpoint
     */
    async queryTask(taskId: string): Promise<TaskStatusResponse['data']> {
        const endpoint = `${this.baseUrl}/api/v1/jobs/recordInfo?taskId=${taskId}`;

        const response = await fetch(endpoint, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Kie.ai Query API Http Error: ${response.status} - ${errorText}`);
        }

        const data: TaskStatusResponse = await response.json();
        if (!data.data) {
            throw new Error(`Kie.ai queryTask Error: No data field in response (JSON: ${JSON.stringify(data)})`);
        }
        return data.data;
    }

    /**
     * Create a task and wait for result (for TTS, image generation, etc.)
     */
    async createTaskAndWait(model: string, input: object, maxWaitMs = 120000): Promise<string> {
        const taskId = await this.createTask(model, input);

        const startTime = Date.now();
        while (Date.now() - startTime < maxWaitMs) {
            await new Promise(resolve => setTimeout(resolve, 1000));

            const status = await this.queryTask(taskId);

            if (status.state === 'success' && status.resultJson) {
                try {
                    const result = JSON.parse(status.resultJson);
                    return result.resultUrls?.[0] || JSON.stringify(result);
                } catch (e) {
                    throw new Error(`Failed to parse resultJson: ${status.resultJson}`);
                }
            } else if (status.state === 'fail') {
                throw new Error(`Task failed: ${status.failMsg || status.failCode || 'Unknown error code'}`);
            } else if (status.state !== 'waiting' && status.state !== 'queuing' && status.state !== 'generating') {
                throw new Error(`Unexpected task state: ${status.state}`);
            }
        }

        throw new Error('Task timeout');
    }

    /**
     * Text-to-Speech using ElevenLabs Turbo 2.5 (fast)
     */
    async textToSpeech(text: string, voiceName: string = 'George'): Promise<string> {
        return this.createTaskAndWait('elevenlabs/text-to-speech-turbo-2-5', {
            text,
            voice: voiceName,
            stability: 0.5,
            language_code: 'ja',
        });
    }

    /**
     * Text-to-Dialogue using ElevenLabs Dialogue v3
     */
    async generateDialogue(script: { speaker: string; text: string }[]): Promise<string> {
        // Map common speaker names to Kie.ai supported voices
        const voiceMapping: Record<string, string> = {
            'George': 'George',
            'Aria': 'Alice' // Map Aria to Alice (valid female voice)
        };

        const dialogue = script.map(line => ({
            voice: voiceMapping[line.speaker] || 'George',
            text: line.text
        }));

        return this.createTaskAndWait('elevenlabs/text-to-dialogue-v3', {
            dialogue,
            language_code: 'ja',
        });
    }
}

// Get or create client instance
let client: KieApiClient | null = null;

export function getKieApiClient(): KieApiClient {
    if (!client) {
        const apiKey = process.env.KEIAPI_KEY;
        if (!apiKey) {
            throw new Error('KEIAPI_KEY is not configured');
        }
        client = new KieApiClient(apiKey);
    }
    return client;
}

export type { ChatMessage };
