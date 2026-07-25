import { describe, expect, it } from 'vitest';
import { CHECKS, getCheck, runChecks } from './index.js';

describe('registry', () => {
  it('exposes every check the rubric can name', () => {
    expect(Object.keys(CHECKS).sort()).toEqual([
      'banned_constructions',
      'length',
      'sections_present',
    ]);
  });

  it('throws on an unknown id, listing the known ones', () => {
    expect(() => getCheck('spelling')).toThrow(
      /unknown deterministic check "spelling"/,
    );
  });
});

describe('runChecks', () => {
  it('runs the specs in order and returns one result per spec', () => {
    const results = runChecks('# Greeting\nHi Tom, see you soon.', [
      { id: 'length', params: { min_words: 1, max_words: 10 } },
      { id: 'sections_present', params: { required: ['closing'] } },
    ]);

    expect(results.map((r) => [r.id, r.pass])).toEqual([
      ['length', true],
      ['sections_present', false],
    ]);
  });

  it('returns nothing when no checks are configured', () => {
    expect(runChecks('text', [])).toEqual([]);
  });
});
