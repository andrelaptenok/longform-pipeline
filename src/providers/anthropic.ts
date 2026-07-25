import {
  postJson,
  DEFAULT_HTTP_POLICY,
  defaultHttpDeps,
  type HttpDeps,
  type HttpPolicy,
} from './http.js';
import { computeCost } from './types.js';
import type {
  GenerateParams,
  GenerateResult,
  Pricing,
  Provider,
  Usage,
} from './types.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

export interface AnthropicOptions {
  policy?: HttpPolicy;
  deps?: HttpDeps;
}

interface StreamState {
  text: string;
  usage: Usage;
  stopReason: string | null;
}

interface StreamEvent {
  type?: string;
  message?: { usage?: { input_tokens?: number; output_tokens?: number } };
  delta?: { type?: string; text?: string; stop_reason?: string | null };
  usage?: { output_tokens?: number };
  error?: { type?: string; message?: string };
}

function applyEvent(state: StreamState, event: StreamEvent): void {
  switch (event.type) {
    case 'message_start': {
      const usage = event.message?.usage;
      state.usage = {
        inputTokens: usage?.input_tokens ?? 0,
        outputTokens: usage?.output_tokens ?? 0,
      };
      return;
    }
    case 'content_block_delta': {
      if (event.delta?.type === 'text_delta' && event.delta.text) {
        state.text += event.delta.text;
      }
      return;
    }
    case 'message_delta': {
      state.stopReason = event.delta?.stop_reason ?? state.stopReason;
      state.usage = {
        inputTokens: state.usage.inputTokens,
        outputTokens: event.usage?.output_tokens ?? state.usage.outputTokens,
      };
      return;
    }
    case 'error': {
      const { type, message } = event.error ?? {};
      throw new Error(
        `anthropic stream error: ${type ?? 'unknown'}: ${message ?? ''}`,
      );
    }
    default:
      return;
  }
}

function applyLine(state: StreamState, line: string): void {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return;

  const payload = trimmed.slice('data:'.length).trim();
  if (payload.length === 0) return;

  let event: StreamEvent;
  try {
    event = JSON.parse(payload) as StreamEvent;
  } catch {
    throw new Error(`anthropic stream carried invalid JSON: ${payload}`);
  }

  applyEvent(state, event);
}

async function readStream(response: Response): Promise<StreamState> {
  const body = response.body;
  if (!body) throw new Error('anthropic: response carried no stream');

  const state: StreamState = {
    text: '',
    usage: { inputTokens: 0, outputTokens: 0 },
    stopReason: null,
  };
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) applyLine(state, line);
  }

  applyLine(state, buffer);
  return state;
}

export class AnthropicProvider implements Provider {
  readonly name = 'anthropic';
  private readonly policy: HttpPolicy;
  private readonly deps: HttpDeps;

  constructor(
    readonly model: string,
    private readonly apiKey: string,
    private readonly pricing: Pricing,
    options: AnthropicOptions = {},
  ) {
    this.policy = options.policy ?? DEFAULT_HTTP_POLICY;
    this.deps = options.deps ?? defaultHttpDeps;
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const started = Date.now();

    const response = await postJson(
      API_URL,
      {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': API_VERSION,
      },
      {
        model: this.model,
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        system: params.system,
        messages: params.messages,
        stream: true,
      },
      this.policy,
      this.deps,
    );

    const state = await readStream(response);

    return {
      text: state.text,
      usage: state.usage,
      costUsd: computeCost(state.usage, this.pricing),
      latencyMs: Date.now() - started,
      model: this.model,
      stopReason: state.stopReason,
    };
  }
}
