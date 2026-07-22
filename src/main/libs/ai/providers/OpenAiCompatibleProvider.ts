// Tevel IntelliDB: OpenAI-compatible chat provider (NIM default).
// Uses the global fetch (Electron main runs on Node >=18). No SDK dependency.

import type {
   AiChatOptions, AiEmbedOptions, AiMessage, AiProviderConfig
} from 'common/interfaces/ai';

import type { AiProvider } from './AiProvider';

interface ChatCompletionResponse {
   // eslint-disable-next-line camelcase
   choices?: { message?: { content?: string; reasoning_content?: string } }[];
   error?: { message?: string };
}

interface EmbeddingResponse {
   data?: { embedding?: number[] }[];
   error?: { message?: string };
}

// Node/Electron provide global fetch at runtime; TS lib (es2021) doesn't type it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const httpFetch: (url: string, init: any) => Promise<any> = (globalThis as any).fetch;

export class OpenAiCompatibleProvider implements AiProvider {
   // eslint-disable-next-line no-useless-constructor
   constructor (private config: AiProviderConfig) {}

   async chat (messages: AiMessage[], options: AiChatOptions = {}): Promise<string> {
      const url = `${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.config.apiKey) headers.Authorization = `Bearer ${this.config.apiKey}`;

      const thinking = !!this.config.enableThinking;
      const reasoningBudget = this.config.reasoningBudget ?? 8192;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: Record<string, any> = {
         model: this.config.model,
         messages,
         // Reasoning models prefer moderate temperature; SQL alone wants it low.
         temperature: options.temperature ?? (thinking ? 0.6 : 0.1),
         top_p: options.topP ?? 0.95,
         max_tokens: options.maxTokens ?? (thinking ? reasoningBudget + 2048 : 1024),
         stream: false
      };
      if (thinking) {
         body.chat_template_kwargs = { enable_thinking: true };
         body.reasoning_budget = reasoningBudget;
      }

      const res = await httpFetch(url, {
         method: 'POST',
         headers,
         body: JSON.stringify(body)
      });

      const raw = await res.text();
      let data: ChatCompletionResponse;
      try {
         data = JSON.parse(raw);
      }
      catch {
         throw new Error(`AI provider returned non-JSON (HTTP ${res.status}): ${raw.slice(0, 300)}`);
      }

      if (!res.ok || data.error)
         throw new Error(data.error?.message || `AI provider error (HTTP ${res.status}): ${raw.slice(0, 300)}`);

      const message = data.choices?.[0]?.message;
      const content = message?.content || message?.reasoning_content;
      if (!content) throw new Error('AI provider returned an empty response.');
      return content;
   }

   async embed (texts: string[], options: AiEmbedOptions = {}): Promise<number[][]> {
      if (!this.config.embedModel) throw new Error('No embedding model configured.');
      const url = `${this.config.baseUrl.replace(/\/$/, '')}/embeddings`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.config.apiKey) headers.Authorization = `Bearer ${this.config.apiKey}`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: Record<string, any> = { model: this.config.embedModel, input: texts };
      // NIM's asymmetric embedders (e.g. nv-embedqa) require input_type + truncate.
      if (this.config.type === 'nim') {
         body.input_type = options.inputType ?? 'passage';
         body.truncate = 'END';
      }

      const res = await httpFetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      const raw = await res.text();
      let data: EmbeddingResponse;
      try {
         data = JSON.parse(raw);
      }
      catch {
         throw new Error(`Embedding endpoint returned non-JSON (HTTP ${res.status}): ${raw.slice(0, 200)}`);
      }
      if (!res.ok || data.error)
         throw new Error(data.error?.message || `Embedding error (HTTP ${res.status}): ${raw.slice(0, 200)}`);

      const vectors = (data.data ?? []).map(d => d.embedding).filter(Boolean) as number[][];
      if (vectors.length !== texts.length) throw new Error('Embedding count mismatch.');
      return vectors;
   }
}
