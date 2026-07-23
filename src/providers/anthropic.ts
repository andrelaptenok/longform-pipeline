import type {
  GenerateParams,
  GenerateResult,
  Pricing,
  Provider,
} from './types.js';
import { computeCost } from './types.js';

const API_URL = 'https://api.anthropic.com/v1/messages';

export class AnthropicProvider implements Provider {
  readonly name = 'anthropic';

  constructor(
    readonly model: string,
    private readonly apiKey: string,
    private readonly pricing: Pricing,
  ) {}

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const started = Date.now();

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        system: params.system,
        messages: params.messages,
      }),
    });

    if (!res.ok) {
      throw new Error(`anthropic ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    const text = data.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('\n');

    const usage = {
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
    };

    return {
      text,
      usage,
      costUsd: computeCost(usage, this.pricing),
      latencyMs: Date.now() - started,
      model: this.model,
    };
  }
}
