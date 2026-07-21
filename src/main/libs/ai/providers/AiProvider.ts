// Tevel IntelliDB — provider abstraction.

import type {
   AiChatOptions, AiEmbedOptions, AiMessage, AiProviderConfig
} from 'common/interfaces/ai';

import { OpenAiCompatibleProvider } from './OpenAiCompatibleProvider';

export interface AiProvider {
   chat (messages: AiMessage[], options?: AiChatOptions): Promise<string>;
   /** Embed texts for semantic retrieval. Optional — not every provider supports it. */
   embed? (texts: string[], options?: AiEmbedOptions): Promise<number[][]>;
}

/**
 * NVIDIA NIM, OpenAI, OpenRouter, LM Studio and Ollama all expose an OpenAI-compatible
 * /chat/completions endpoint, so one client serves them. Anthropic uses a different
 * wire format — add a dedicated provider when we need it (ROADMAP Phase 5).
 */
export function createProvider (config: AiProviderConfig): AiProvider {
   switch (config.type) {
      case 'nim':
      case 'openai':
      case 'openrouter':
      case 'lmstudio':
      case 'ollama':
         return new OpenAiCompatibleProvider(config);
      case 'anthropic':
         throw new Error('Anthropic provider not implemented yet. Use an OpenAI-compatible provider.');
      default:
         throw new Error(`Unknown AI provider: ${config.type}`);
   }
}
