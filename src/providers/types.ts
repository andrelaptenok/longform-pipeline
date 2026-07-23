export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateParams {
  system: string;
  messages: Message[];
  maxTokens: number;
  temperature?: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface GenerateResult {
  text: string;
  usage: Usage;
  costUsd: number;
  latencyMs: number;
  model: string;
}

export interface Provider {
  readonly name: string;
  readonly model: string;
  generate(params: GenerateParams): Promise<GenerateResult>;
}

/** Price per 1M tokens. Update when switching models. */
export interface Pricing {
  inputPerMTok: number;
  outputPerMTok: number;
}

export function computeCost(usage: Usage, pricing: Pricing): number {
  return (
    (usage.inputTokens / 1_000_000) * pricing.inputPerMTok +
    (usage.outputTokens / 1_000_000) * pricing.outputPerMTok
  );
}
