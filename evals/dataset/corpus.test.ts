import { basename } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadDataset, type DatasetItem } from '../dataset.js';
import { loadRubric } from '../rubric.js';
import { checkSpecsFor, evaluateItem } from '../specs.js';

const TRAIN = 'evals/dataset/train';
const HELD_OUT = 'evals/dataset/test';

const train = () => loadDataset(TRAIN);
const corpus = () => [...loadDataset(TRAIN), ...loadDataset(HELD_OUT)];

const where = (item: DatasetItem) => `${item.file} (${item.id})`;

describe('the committed corpus', () => {
  it('parses every item in both splits', () => {
    expect(() => loadDataset(TRAIN)).not.toThrow();
    expect(() => loadDataset(HELD_OUT)).not.toThrow();
  });

  it('gives every item a unique id', () => {
    const ids = corpus().map((item) => item.id);
    expect(ids).toEqual([...new Set(ids)]);
  });

  it('names every file after the id it carries', () => {
    for (const item of corpus()) {
      expect(basename(item.file, '.md'), where(item)).toBe(item.id);
    }
  });

  it('declares where every item came from', () => {
    for (const item of corpus()) {
      expect(item.source.trim(), where(item)).not.toBe('');
    }
  });

  it('scores every item on every rubric dimension', () => {
    const dimensions = loadRubric()
      .judge.map((dimension) => dimension.id)
      .sort();

    for (const item of corpus()) {
      expect(Object.keys(item.humanScores).sort(), where(item)).toEqual(
        dimensions,
      );
    }
  });

  it('keeps every human score an integer within the rubric scale', () => {
    for (const item of corpus()) {
      for (const [dimension, score] of Object.entries(item.humanScores)) {
        expect(Number.isInteger(score), `${where(item)} ${dimension}`).toBe(
          true,
        );
        expect(score, `${where(item)} ${dimension}`).toBeGreaterThanOrEqual(1);
        expect(score, `${where(item)} ${dimension}`).toBeLessThanOrEqual(5);
      }
    }
  });

  it('resolves every check override against the rubric', () => {
    const rubric = loadRubric();

    for (const item of corpus()) {
      expect(() => checkSpecsFor(rubric, item), where(item)).not.toThrow();
    }
  });
});

describe('the training split', () => {
  it('passes the deterministic layer on every item', () => {
    const rubric = loadRubric();

    for (const item of train()) {
      const failed = evaluateItem(rubric, item)
        .filter((result) => !result.pass)
        .map((result) => `${result.id}: ${result.detail}`);

      expect(failed, where(item)).toEqual([]);
    }
  });
});
