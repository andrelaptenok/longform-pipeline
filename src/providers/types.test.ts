import { describe, expect, it } from 'vitest';
import { computeCost, type Pricing, type Usage } from './types.js';

const PRICING: Pricing = { inputPerMTok: 3, outputPerMTok: 15 };

const usage = (inputTokens: number, outputTokens: number): Usage => ({
  inputTokens,
  outputTokens,
});

describe('computeCost', () => {
  it('prices input and output per million tokens', () => {
    expect(computeCost(usage(1_000_000, 1_000_000), PRICING)).toBeCloseTo(18);
  });

  it('scales below a million', () => {
    expect(computeCost(usage(1000, 500), PRICING)).toBeCloseTo(0.0105, 10);
  });

  it('charges nothing for an empty call', () => {
    expect(computeCost(usage(0, 0), PRICING)).toBe(0);
  });

  it('prices output higher than input at the same volume', () => {
    expect(computeCost(usage(0, 1000), PRICING)).toBeGreaterThan(
      computeCost(usage(1000, 0), PRICING),
    );
  });
});
