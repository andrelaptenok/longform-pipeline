import { describe, expect, it } from 'vitest';
import { parseDatasetItem } from './dataset.js';
import { parseRubric } from './rubric.js';
import { checkSpecsFor, deviations, evaluateItem } from './specs.js';

const RUBRIC = parseRubric(
  `
version: v1
deterministic:
  - id: length
    description: word count within the CKE range
    params: { min_words: 200, max_words: 250 }
  - id: banned_constructions
    description: no spoken reductions
    params: { patterns: ['\\bgonna\\b'] }
judge:
  - id: content
    cke_name: treść
    weight: 5
    description: every element of the task is covered
    scale: 1-5
    anchors: { '1': half is missing, '5': everything is there }
`,
  'rubric.yaml',
);

function item(frontmatter: string) {
  return parseDatasetItem(
    `---\nid: a\ntask_type: t\nbrief: b\nsource: self-authored\n${frontmatter}---\nHi Tom, I am gonna write.\n`,
    'item.md',
  );
}

describe('checkSpecsFor', () => {
  it('runs the checks the rubric lists, in order', () => {
    const specs = checkSpecsFor(RUBRIC, item(''));

    expect(specs.map((spec) => spec.id)).toEqual([
      'length',
      'banned_constructions',
    ]);
  });

  it('falls back to the rubric defaults when the item says nothing', () => {
    const specs = checkSpecsFor(RUBRIC, item(''));

    expect(specs[0]?.params).toEqual({ min_words: 200, max_words: 250 });
  });

  it('lets an item override a single param, keeping the rest', () => {
    const specs = checkSpecsFor(
      RUBRIC,
      item('expected:\n  length: { max_words: 130 }\n'),
    );

    expect(specs[0]?.params).toEqual({ min_words: 200, max_words: 130 });
  });

  it('rejects an override for a check the rubric does not list', () => {
    expect(() =>
      checkSpecsFor(
        RUBRIC,
        item('expected:\n  sections_present: { required: [greeting] }\n'),
      ),
    ).toThrow(
      /item\.md: expected\.sections_present is not a check in the rubric \(known: length, banned_constructions\)/,
    );
  });

  it('rejects a param the check does not have, misspelled or otherwise', () => {
    expect(() =>
      checkSpecsFor(RUBRIC, item('expected:\n  length: { min_word: 1 }\n')),
    ).toThrow(
      /item\.md: expected\.length\.min_word is not a param of the length check \(known: min_words, max_words\)/,
    );
  });

  it('rejects a declared failure for a check the rubric does not list', () => {
    expect(() =>
      checkSpecsFor(RUBRIC, item('expected_failures: [sections_present]\n')),
    ).toThrow(
      /item\.md: expected_failures names sections_present, which is not a check in the rubric \(known: length, banned_constructions\)/,
    );
  });

  it('replaces a list param rather than extending it', () => {
    const specs = checkSpecsFor(
      RUBRIC,
      item("expected:\n  banned_constructions: { patterns: ['\\bfoo\\b'] }\n"),
    );

    expect(specs[1]?.params).toEqual({ patterns: ['\\bfoo\\b'] });
  });
});

describe('evaluateItem', () => {
  it('runs the resolved specs against the reference material', () => {
    const results = evaluateItem(
      RUBRIC,
      item('expected:\n  length: { min_words: 1, max_words: 10 }\n'),
    );

    expect(results.map((result) => [result.id, result.pass])).toEqual([
      ['length', true],
      ['banned_constructions', false],
    ]);
  });
});

describe('deviations', () => {
  const short = 'expected:\n  length: { min_words: 1, max_words: 10 }\n';

  it('reports a failure the item did not declare', () => {
    const material = item(short);

    expect(deviations(material, evaluateItem(RUBRIC, material))).toEqual([
      'banned_constructions: banned patterns matched: \\bgonna\\b',
    ]);
  });

  it('says nothing about a failure the item declared', () => {
    const material = item(
      `${short}expected_failures: [banned_constructions]\n`,
    );

    expect(deviations(material, evaluateItem(RUBRIC, material))).toEqual([]);
  });

  it('reports a declared failure that did not happen', () => {
    const material = item(`${short}expected_failures: [length]\n`);

    expect(deviations(material, evaluateItem(RUBRIC, material))).toEqual([
      'length: declared in expected_failures, but it passed',
      'banned_constructions: banned patterns matched: \\bgonna\\b',
    ]);
  });
});
