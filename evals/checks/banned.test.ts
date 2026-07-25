import { describe, expect, it } from 'vitest';
import { bannedConstructionsCheck } from './banned.js';

describe('bannedConstructionsCheck', () => {
  const params = { patterns: ['\\bkinda\\b', 'gonna'] };

  it('passes when no pattern matches', () => {
    const result = bannedConstructionsCheck('I am going to write.', params);
    expect(result.pass).toBe(true);
    expect(result.observed).toMatchObject({ matched: [] });
  });

  it('fails and reports every matching pattern', () => {
    const result = bannedConstructionsCheck(
      'I am gonna, kinda, leave.',
      params,
    );
    expect(result.pass).toBe(false);
    expect(result.observed).toMatchObject({ matched: params.patterns });
  });

  it('matches case-insensitively', () => {
    expect(bannedConstructionsCheck('GONNA', params).pass).toBe(false);
  });

  it('honours word boundaries in the pattern', () => {
    expect(bannedConstructionsCheck('kindare', params).pass).toBe(true);
  });

  it('passes vacuously with no patterns', () => {
    expect(bannedConstructionsCheck('anything', { patterns: [] }).pass).toBe(
      true,
    );
  });

  it('names the offending pattern when the regex is invalid', () => {
    expect(() => bannedConstructionsCheck('text', { patterns: ['('] })).toThrow(
      /"\("/,
    );
  });
});
