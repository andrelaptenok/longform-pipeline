import { describe, expect, it } from 'vitest';
import { loadPrompt } from './prompts.js';

describe('loadPrompt', () => {
  it('loads a versioned prompt file by name and version', () => {
    const prompt = loadPrompt('plan', 'v1');

    expect(prompt.body.length).toBeGreaterThan(0);
    expect(prompt.body).toMatch(/matura/i);
  });

  it('stamps the version that goes into every call record', () => {
    expect(loadPrompt('plan', 'v1').version).toBe('plan.v1');
  });

  it('fails loudly when the version does not exist', () => {
    expect(() => loadPrompt('plan', 'v99')).toThrow(/plan\.v99\.md/);
  });
});
