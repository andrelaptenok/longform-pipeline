import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadRubric, parseRubric, RUBRIC_PATH } from './rubric.js';

const RUBRIC = `
version: v1
deterministic:
  - id: length
    description: word count within the CKE range
    params: { min_words: 200, max_words: 250 }
judge:
  - id: content
    cke_name: treść
    weight: 5
    description: every element of the task is covered
    scale: 1-5
    anchors:
      '1': half the elements are missing
      '5': every element is present and developed
`;

describe('parseRubric', () => {
  it('reads checks and judge dimensions', () => {
    const rubric = parseRubric(RUBRIC, 'rubric.yaml');

    expect(rubric.version).toBe('v1');
    expect(rubric.deterministic[0]).toMatchObject({
      id: 'length',
      params: { min_words: 200, max_words: 250 },
    });
    expect(rubric.judge[0]).toMatchObject({
      id: 'content',
      cke_name: 'treść',
      weight: 5,
    });
    expect(rubric.judge[0]?.anchors['5']).toMatch(/every element/);
  });

  it('names the file and the field when a check is malformed', () => {
    const broken = RUBRIC.replace(
      '    params: { min_words: 200, max_words: 250 }',
      '',
    );
    expect(() => parseRubric(broken, 'rubric.yaml')).toThrow(
      /rubric\.yaml: deterministic\[0\]\.params must be a map/,
    );
  });

  it('rejects a rubric without deterministic checks', () => {
    expect(() => parseRubric('version: v1\njudge: []', 'rubric.yaml')).toThrow(
      /deterministic must be an array/,
    );
  });

  it('rejects a judge dimension without a positive weight', () => {
    const broken = RUBRIC.replace('weight: 5', 'weight: 0');
    expect(() => parseRubric(broken, 'rubric.yaml')).toThrow(
      /judge\[0\]\.weight must be a positive number/,
    );
  });

  it('rejects a dimension without anchors', () => {
    const broken = RUBRIC.replace(/ {4}anchors:[\s\S]*$/, '');
    expect(() => parseRubric(broken, 'rubric.yaml')).toThrow(
      /judge\[0\]\.anchors must be a map/,
    );
  });

  it('prefixes a YAML syntax error with the file', () => {
    expect(() => parseRubric('version: [unclosed', 'rubric.yaml')).toThrow(
      /rubric\.yaml: invalid YAML/,
    );
  });
});

describe('the committed rubric', () => {
  it('parses and covers the four CKE dimensions', () => {
    const rubric = loadRubric();

    expect(rubric.judge.map((d) => d.id)).toEqual([
      'content',
      'coherence',
      'range',
      'accuracy',
    ]);
    expect(rubric.judge.reduce((sum, d) => sum + d.weight, 0)).toBe(13);
    expect(rubric.deterministic.map((c) => c.id)).toEqual([
      'length',
      'sections_present',
      'banned_constructions',
    ]);
  });

  it('checks length against the band CKE scores, not the one it asks for', () => {
    const length = loadRubric().deterministic.find(
      (check) => check.id === 'length',
    );

    expect(length?.params).toEqual({ min_words: 180, max_words: 280 });
  });

  it('anchors every dimension at the ends of the scale', () => {
    for (const dimension of loadRubric().judge) {
      expect(Object.keys(dimension.anchors)).toEqual(['1', '3', '5']);
    }
  });

  it('is the file the runner loads by default', () => {
    expect(parseRubric(readFileSync(RUBRIC_PATH, 'utf8'), RUBRIC_PATH)).toEqual(
      loadRubric(),
    );
  });
});
