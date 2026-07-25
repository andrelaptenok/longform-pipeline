import { describe, expect, it } from 'vitest';
import { extractSections, sectionsPresentCheck } from './sections.js';

describe('extractSections', () => {
  it('reads markdown headings of any level', () => {
    expect(extractSections('# Greeting\n\n### Closing')).toEqual([
      'greeting',
      'closing',
    ]);
  });

  it('reads label lines, with or without emphasis', () => {
    expect(extractSections('Greeting:\n\n**Closing:**')).toEqual([
      'greeting',
      'closing',
    ]);
  });

  it('ignores a colon inside a sentence', () => {
    expect(extractSections('He said: it was a good trip.')).toEqual([]);
  });

  it('normalizes case and inner whitespace', () => {
    expect(extractSections('##   Main   BODY  ')).toEqual(['main body']);
  });
});

describe('sectionsPresentCheck', () => {
  const params = { required: ['greeting', 'body', 'closing'] };
  const material = '# Greeting\nHi Tom!\n\n# Body\n...\n\n# Closing\nSee you.';

  it('passes when every required section is present', () => {
    const result = sectionsPresentCheck(material, params);
    expect(result.pass).toBe(true);
    expect(result.observed).toMatchObject({ missing: [] });
  });

  it('matches a required name inside a longer heading', () => {
    const wordy = '# Greeting\n...\n# Body of the email\n...\n# Closing line';
    expect(sectionsPresentCheck(wordy, params).pass).toBe(true);
  });

  it('is case-insensitive on both sides', () => {
    const upper = '# GREETING\n# BODY\n# CLOSING';
    expect(
      sectionsPresentCheck(upper, { required: ['Greeting', 'Body', 'Closing'] })
        .pass,
    ).toBe(true);
  });

  it('lists the missing sections when one is absent', () => {
    const result = sectionsPresentCheck('# Greeting\n# Body', params);
    expect(result.pass).toBe(false);
    expect(result.observed).toMatchObject({ missing: ['closing'] });
    expect(result.detail).toContain('closing');
  });

  it('passes vacuously when nothing is required', () => {
    expect(sectionsPresentCheck('plain text', { required: [] }).pass).toBe(
      true,
    );
  });

  it('rejects malformed params', () => {
    expect(() =>
      sectionsPresentCheck('text', { required: 'greeting' }),
    ).toThrow(/required/);
  });
});
