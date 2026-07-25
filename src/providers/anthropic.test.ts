import { describe, expect, it } from 'vitest';
import { AnthropicProvider } from './anthropic.js';
import type { HttpDeps, HttpPolicy } from './http.js';
import type { Pricing } from './types.js';

const PRICING: Pricing = { inputPerMTok: 3, outputPerMTok: 15 };
const POLICY: HttpPolicy = { maxRetries: 0, timeoutMs: 1000, baseDelayMs: 0 };

function sse(events: Array<Record<string, unknown>>): string {
  return events
    .map(
      (event) =>
        `event: ${String(event.type)}\ndata: ${JSON.stringify(event)}\n\n`,
    )
    .join('');
}

const MESSAGE = sse([
  {
    type: 'message_start',
    message: { usage: { input_tokens: 120, output_tokens: 0 } },
  },
  { type: 'content_block_start', index: 0 },
  {
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'text_delta', text: 'A plan' },
  },
  {
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'text_delta', text: ' in two parts.' },
  },
  { type: 'content_block_stop', index: 0 },
  {
    type: 'message_delta',
    delta: { stop_reason: 'end_turn' },
    usage: { output_tokens: 240 },
  },
  { type: 'message_stop' },
]);

function providerFor(body: string, status = 200) {
  const requests: Array<Record<string, unknown>> = [];

  const deps: HttpDeps = {
    fetch: (_url, init) => {
      requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return Promise.resolve(new Response(body, { status }));
    },
    sleep: () => Promise.resolve(),
  };

  const provider = new AnthropicProvider(
    'claude-sonnet-4-6',
    'test-key',
    PRICING,
    {
      policy: POLICY,
      deps,
    },
  );

  return { provider, requests };
}

const PARAMS = {
  system: 'You are an instructional designer.',
  messages: [{ role: 'user' as const, content: 'Write a plan.' }],
  maxTokens: 2000,
};

describe('AnthropicProvider', () => {
  it('asks the API to stream, so long outputs cannot time out', async () => {
    const { provider, requests } = providerFor(MESSAGE);

    await provider.generate(PARAMS);

    expect(requests[0]).toMatchObject({
      stream: true,
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
    });
  });

  it('joins the streamed deltas into the final text', async () => {
    const { provider } = providerFor(MESSAGE);

    const result = await provider.generate(PARAMS);

    expect(result.text).toBe('A plan in two parts.');
  });

  it('reads usage from the stream and prices it', async () => {
    const { provider } = providerFor(MESSAGE);

    const result = await provider.generate(PARAMS);

    expect(result.usage).toEqual({ inputTokens: 120, outputTokens: 240 });
    expect(result.costUsd).toBeCloseTo(0.00396, 10);
    expect(result.model).toBe('claude-sonnet-4-6');
  });

  it('reports the stop reason, so a truncated call is visible', async () => {
    const { provider } = providerFor(MESSAGE);
    expect((await provider.generate(PARAMS)).stopReason).toBe('end_turn');

    const truncated = providerFor(
      sse([
        {
          type: 'message_start',
          message: { usage: { input_tokens: 10, output_tokens: 0 } },
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'cut' },
        },
        {
          type: 'message_delta',
          delta: { stop_reason: 'max_tokens' },
          usage: { output_tokens: 2000 },
        },
      ]),
    );
    expect((await truncated.provider.generate(PARAMS)).stopReason).toBe(
      'max_tokens',
    );
  });

  it('ignores events it does not model', async () => {
    const { provider } = providerFor(
      `event: ping\ndata: {"type":"ping"}\n\n${MESSAGE}`,
    );

    expect((await provider.generate(PARAMS)).text).toBe('A plan in two parts.');
  });

  it('surfaces an error event as an error', async () => {
    const { provider } = providerFor(
      sse([
        {
          type: 'error',
          error: { type: 'overloaded_error', message: 'Overloaded' },
        },
      ]),
    );

    await expect(provider.generate(PARAMS)).rejects.toThrow(
      /anthropic stream error: overloaded_error: Overloaded/,
    );
  });

  it('reports a malformed stream rather than returning empty text', async () => {
    const { provider } = providerFor('data: {not json}\n\n');

    await expect(provider.generate(PARAMS)).rejects.toThrow(/invalid JSON/);
  });

  it('surfaces a rejected request with its status and body', async () => {
    const { provider } = providerFor('{"error":"bad key"}', 401);

    await expect(provider.generate(PARAMS)).rejects.toThrow(/http 401/);
  });
});
