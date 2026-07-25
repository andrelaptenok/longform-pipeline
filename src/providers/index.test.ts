import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getProvider } from './index.js';

const KEY = 'ANTHROPIC_API_KEY';
let saved: string | undefined;

beforeEach(() => {
  saved = process.env[KEY];
});

afterEach(() => {
  if (saved === undefined) delete process.env[KEY];
  else process.env[KEY] = saved;
});

describe('getProvider', () => {
  it('builds the Anthropic provider for "claude"', () => {
    process.env[KEY] = 'test-key';
    const provider = getProvider('claude');

    expect(provider.name).toBe('anthropic');
    expect(provider.model).toBe('claude-sonnet-4-6');
  });

  it('names the missing variable rather than failing at request time', () => {
    delete process.env[KEY];

    expect(() => getProvider('claude')).toThrow(
      /Missing env var: ANTHROPIC_API_KEY/,
    );
  });

  it('rejects a provider it does not know', () => {
    expect(() => getProvider('gpt')).toThrow(/Unknown provider: gpt/);
  });
});
