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
     * For models like Gemini 3 Flash, the model name is in the URL path
     */
    async chat(messages: ChatMessage[], model: string = 'gemini-3-flash'): Promise<string> {
        const endpoint = `${this.baseUrl}/${model}/v1/chat/completions`;

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

        const data: ChatCompletionResponse = await response.json();
        return data.choices?.[0]?.message?.content || '';
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
            const error = await response.text();
            throw new Error(`Kie.ai Task API Error: ${response.status} - ${error}`);
        }

        const data: TaskResponse = await response.json();
        if (data.code !== 200) {
            throw new Error(`Kie.ai Error: ${data.message}`);
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
            const error = await response.text();
            throw new Error(`Kie.ai Query API Error: ${response.status} - ${error}`);
        }

        const data: TaskStatusResponse = await response.json();
        return data.data;
    }

    /**
     * Create a task and wait for result (for TTS, image generation, etc.)
     */
    async createTaskAndWait(model: string, input: object, maxWaitMs = 60000): Promise<string> {
        const taskId = await this.createTask(model, input);

        const startTime = Date.now();
        while (Date.now() - startTime < maxWaitMs) {
            await new Promise(resolve => setTimeout(resolve, 1000));

            const status = await this.queryTask(taskId);

            if (status.state === 'success' && status.resultJson) {
                const result = JSON.parse(status.resultJson);
                return result.resultUrls?.[0] || JSON.stringify(result);
            } else if (status.state === 'fail') {
                throw new Error(`Task failed: ${status.failMsg || status.failCode || 'Unknown error'}`);
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
