import { describe, expect, it } from 'vitest';
import {
  judgeItem,
  parseVerdict,
  renderRubric,
  scaleBoundsOf,
} from './judge.js';
import { parseDatasetItem } from './dataset.js';
import { parseRubric } from './rubric.js';
import type {
  GenerateParams,
  GenerateResult,
  Provider,
} from '../src/providers/types.js';

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
    description: every element of the task is covered
    scale: 1-5
    anchors: { '1': half is missing, '5': everything is there }
  - id: accuracy
    cke_name: poprawność środków językowych
    weight: 3
    description: grammar, lexis, spelling
    scale: 1-5
    anchors: { '1': errors obscure meaning, '5': few minor errors }
`,
  'rubric.yaml',
);

const ITEM = parseDatasetItem(
  `---\nid: article-01\ntask_type: article\nbrief: 'Write an article about a school trip.'\nsource: self-authored\n---\nLast spring our class travelled to the mountains.\n`,
  'evals/dataset/train/article-01.md',
);

const VERDICT = JSON.stringify({
  content: {
    score: 4,
    why: 'Both elements are covered, the second only briefly.',
  },
  accuracy: { score: 5, why: 'Two article slips, neither obscuring meaning.' },
});

function providerReturning(...replies: string[]): Provider & {
  calls: GenerateParams[];
} {
  const calls: GenerateParams[] = [];
  let index = 0;

  return {
    name: 'fake',
    model: 'fake-model',
    calls,
    generate(params: GenerateParams): Promise<GenerateResult> {
      calls.push(params);
      const text = replies[index++] ?? '';
      return Promise.resolve({
        text,
        usage: { inputTokens: 10, outputTokens: 20 },
        costUsd: 0.001,
        latencyMs: 5,
        model: 'fake-model',
        stopReason: 'end_turn',
      });
    },
  };
}

describe('scaleBoundsOf', () => {
  it('reads the bounds the rubric declares', () => {
    expect(scaleBoundsOf(RUBRIC.judge[0]!)).toEqual({ min: 1, max: 5 });
  });

  it('refuses a scale it cannot read', () => {
    expect(() =>
      scaleBoundsOf({ ...RUBRIC.judge[0]!, scale: 'one to five' }),
    ).toThrow(/unreadable scale/);
  });
});

describe('renderRubric', () => {
  it('gives the judge each dimension with its anchors in scale order', () => {
    const rendered = renderRubric(RUBRIC);

    expect(rendered).toContain('content (zgodność z poleceniem), scale 1-5');
    expect(rendered.indexOf('1: half is missing')).toBeLessThan(
      rendered.indexOf('5: everything is there'),
    );
  });
});

describe('parseVerdict', () => {
  it('reads a clean reply', () => {
    expect(parseVerdict(VERDICT, RUBRIC)).toEqual({
      content: {
        score: 4,
        why: 'Both elements are covered, the second only briefly.',
      },
      accuracy: {
        score: 5,
        why: 'Two article slips, neither obscuring meaning.',
      },
    });
  });

  it('reads a reply wrapped in a code fence or prose', () => {
    expect(
      parseVerdict('Here you go:\n```json\n' + VERDICT + '\n```', RUBRIC),
    ).toHaveProperty('content.score', 4);
  });

  it('rejects a missing dimension', () => {
    const partial = JSON.stringify({ content: { score: 4, why: 'ok' } });
    expect(() => parseVerdict(partial, RUBRIC)).toThrow(
      /left out the dimension "accuracy"/,
    );
  });

  it('rejects a score outside the scale, or not a whole number', () => {
    const outside = JSON.stringify({
      content: { score: 7, why: 'ok' },
      accuracy: { score: 5, why: 'ok' },
    });
    const fractional = JSON.stringify({
      content: { score: 4.5, why: 'ok' },
      accuracy: { score: 5, why: 'ok' },
    });

    expect(() => parseVerdict(outside, RUBRIC)).toThrow(
      /outside the integer range 1-5/,
    );
    expect(() => parseVerdict(fractional, RUBRIC)).toThrow(
      /outside the integer range/,
    );
  });

  it('rejects a score with no justification', () => {
    const silent = JSON.stringify({
      content: { score: 4, why: '  ' },
      accuracy: { score: 5, why: 'ok' },
    });

    expect(() => parseVerdict(silent, RUBRIC)).toThrow(
      /no justification for "content"/,
    );
  });

  it('rejects dimensions the rubric does not have', () => {
    const extra = JSON.stringify({
      content: { score: 4, why: 'ok' },
      accuracy: { score: 5, why: 'ok' },
      style: { score: 3, why: 'ok' },
    });

    expect(() => parseVerdict(extra, RUBRIC)).toThrow(
      /invented dimensions: style/,
    );
  });

  it('reports a reply that carries no JSON at all', () => {
    expect(() =>
      parseVerdict('I would rather not score this.', RUBRIC),
    ).toThrow(/no JSON object/);
  });
});

describe('judgeItem', () => {
  it('scores an item and stamps the prompt and rubric versions', async () => {
    const provider = providerReturning(VERDICT);

    const verdict = await judgeItem(provider, RUBRIC, ITEM);

    expect(verdict).toMatchObject({
      itemId: 'article-01',
      promptVersion: 'judge.v1',
      rubricVersion: 'v1',
    });
    expect(verdict.scores.content?.score).toBe(4);
  });

  it('sends the rubric and the material, and asks for no sampling parameters', async () => {
    const provider = providerReturning(VERDICT);

    await judgeItem(provider, RUBRIC, ITEM);

    const call = provider.calls[0];
    expect(call?.system).toContain('zgodność z poleceniem');
    expect(call?.messages[0]?.content).toContain('school trip');
    expect(call?.messages[0]?.content).toContain('travelled to the mountains');
    expect(call?.temperature).toBeUndefined();
  });

  it('tells the judge what was wrong and takes the corrected reply', async () => {
    const provider = providerReturning(
      '{"content": {"score": 4, "why": "ok"}}',
      VERDICT,
    );

    const verdict = await judgeItem(provider, RUBRIC, ITEM);

    expect(verdict.scores.accuracy?.score).toBe(5);
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[1]?.messages.at(-1)?.content).toContain(
      'left out the dimension "accuracy"',
    );
  });

  it('gives up after the allowed attempts, naming the file', async () => {
    const provider = providerReturning('nonsense', 'still nonsense');

    await expect(judgeItem(provider, RUBRIC, ITEM)).rejects.toThrow(
      /evals\/dataset\/train\/article-01\.md: judge returned no JSON object/,
    );
    expect(provider.calls).toHaveLength(2);
  });
});
