import { describe, expect, it } from 'vitest';
import { countWords, lengthCheck } from './length.js';

describe('countWords', () => {
  it('counts words separated by any whitespace', () => {
    expect(countWords('one two\tthree\nfour')).toBe(4);
  });

  it('keeps contractions and hyphenated words as one word', () => {
    expect(countWords("don't be well-known")).toBe(3);
  });

  it('ignores markdown punctuation', () => {
    expect(countWords('## Greeting\n\n- **Hi** there!')).toBe(3);
  });

  it('returns 0 for text without words', () => {
    expect(countWords('  \n --- \n ')).toBe(0);
  });
});

describe('lengthCheck', () => {
  const params = { min_words: 3, max_words: 5 };

  it('passes inside the range', () => {
    const result = lengthCheck('one two three four', params);
    expect(result.pass).toBe(true);
    expect(result.observed).toMatchObject({ words: 4 });
  });

  it('passes on the boundaries', () => {
    expect(lengthCheck('one two three', params).pass).toBe(true);
    expect(lengthCheck('one two three four five', params).pass).toBe(true);
  });

  it('fails below and above the range', () => {
    expect(lengthCheck('one two', params).pass).toBe(false);
    expect(lengthCheck('one two three four five six', params).pass).toBe(false);
  });

  it('reports the observed count in the detail', () => {
    expect(lengthCheck('one two', params).detail).toContain('2 words');
  });

  it('rejects malformed params', () => {
    expect(() => lengthCheck('text', { min_words: '3', max_words: 5 })).toThrow(
      /min_words/,
    );
  });
});
