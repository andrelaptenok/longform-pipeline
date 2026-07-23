import { AnthropicProvider } from './anthropic.js';
import type { Provider } from './types.js';

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

/**
 * Provider registry. When adding OpenAI/Gemini/Ollama, implement the same
 * Provider interface — comparing models at eval time then requires no changes
 * to the pipeline.
 */
export function getProvider(id: string): Provider {
  switch (id) {
    case 'claude':
      return new AnthropicProvider(
        'claude-sonnet-4-6',
        requireEnv('ANTHROPIC_API_KEY'),
        { inputPerMTok: 3, outputPerMTok: 15 },
      );
    default:
      throw new Error(`Unknown provider: ${id}`);
  }
}

export type { Provider } from './types.js';
