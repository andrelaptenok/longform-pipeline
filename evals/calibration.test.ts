import { describe, expect, it } from 'vitest';
import { calibrate } from './calibration.js';
import { parseDatasetItem } from './dataset.js';
import { parseRubric } from './rubric.js';
import type { JudgeVerdict } from './judge.js';

const RUBRIC = parseRubric(
  `
version: v1
deterministic:
  - id: length
    description: word count
    params: { min_words: 180, max_words: 280 }
judge:
  - id: content
    cke_name: zgodność z poleceniem
    weight: 5
    description: task coverage
    scale: 1-5
    anchors: { '1': half is missing, '5': everything is there }
  - id: accuracy
    cke_name: poprawność środków językowych
    weight: 3
    description: grammar and lexis
    scale: 1-5
    anchors: { '1': errors obscure meaning, '5': few minor errors }
`,
  'rubric.yaml',
);

function item(id: string, scores: Record<string, number>) {
  const frontmatter = Object.entries(scores)
    .map(([dimension, score]) => `${dimension}: ${score}`)
    .join(', ');

  return parseDatasetItem(
    `---\nid: ${id}\ntask_type: article\nbrief: b\nsource: self-authored\nhuman_scores: { ${frontmatter} }\n---\ntext`,
    `${id}.md`,
  );
}

function verdict(id: string, scores: Record<string, number>): JudgeVerdict {
  return {
    itemId: id,
    promptVersion: 'judge.v1',
    rubricVersion: 'v1',
    scores: Object.fromEntries(
      Object.entries(scores).map(([dimension, score]) => [
        dimension,
        { score, why: 'because' },
      ]),
    ),
  };
}

describe('calibrate', () => {
  it('pairs each judge score with the expert score for the same item', () => {
    const items = [
      item('a', { content: 5, accuracy: 4 }),
      item('b', { content: 2, accuracy: 3 }),
    ];
    const verdicts = [
      verdict('a', { content: 5, accuracy: 4 }),
      verdict('b', { content: 2, accuracy: 3 }),
    ];

    const result = calibrate(RUBRIC, items, verdicts);

    expect(result.map((row) => row.dimension)).toEqual(['content', 'accuracy']);
    expect(result[0]).toMatchObject({ pairs: 2, qwk: 1, mae: 0, exact: 1 });
  });

  it('matches by item id, not by position', () => {
    const items = [
      item('a', { content: 5, accuracy: 5 }),
      item('b', { content: 1, accuracy: 1 }),
    ];
    const verdicts = [
      verdict('b', { content: 1, accuracy: 1 }),
      verdict('a', { content: 5, accuracy: 5 }),
    ];

    expect(calibrate(RUBRIC, items, verdicts)[0]).toMatchObject({
      mae: 0,
      exact: 1,
    });
  });

  it('counts an unlabeled dimension as skipped rather than scoring it as zero', () => {
    const items = [
      item('a', { content: 4 }),
      item('b', { content: 3, accuracy: 3 }),
    ];
    const verdicts = [
      verdict('a', { content: 4, accuracy: 5 }),
      verdict('b', { content: 3, accuracy: 3 }),
    ];

    const result = calibrate(RUBRIC, items, verdicts);

    expect(result.find((row) => row.dimension === 'content')).toMatchObject({
      pairs: 2,
      skipped: 0,
    });
    expect(result.find((row) => row.dimension === 'accuracy')).toMatchObject({
      pairs: 1,
      skipped: 1,
    });
  });

  it('refuses two verdicts for one item rather than counting it twice', () => {
    expect(() =>
      calibrate(
        RUBRIC,
        [item('a', { content: 4 })],
        [verdict('a', { content: 4 }), verdict('a', { content: 2 })],
      ),
    ).toThrow(/two verdicts for "a"/);
  });

  it('reports nothing for a dimension no item carries', () => {
    const result = calibrate(
      RUBRIC,
      [item('a', { content: 4 })],
      [verdict('a', { content: 4 })],
    );

    expect(result.map((row) => row.dimension)).toEqual(['content']);
  });
});
