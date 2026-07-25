import { basename } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadDataset, type DatasetItem } from '../dataset.js';
import { loadRubric } from '../rubric.js';
import { checkSpecsFor, evaluateItem } from '../specs.js';

const TRAIN = 'evals/dataset/train';
const HELD_OUT = 'evals/dataset/test';

const train = () => loadDataset(TRAIN);
const heldOut = () => loadDataset(HELD_OUT);
const corpus = () => [...loadDataset(TRAIN), ...loadDataset(HELD_OUT)];

const where = (item: DatasetItem) => `${item.file} (${item.id})`;
const familyOf = (item: DatasetItem) => item.derivedFrom ?? item.id;

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

  it('derives every variant from a base material that exists', () => {
    const items = corpus();
    const byId = new Map(items.map((item) => [item.id, item]));

    for (const item of items) {
      if (item.derivedFrom === null) continue;
      expect(byId.has(item.derivedFrom), where(item)).toBe(true);
    }
  });

  it('derives variants from base materials, never from other variants', () => {
    const items = corpus();
    const byId = new Map(items.map((item) => [item.id, item]));

    for (const item of items) {
      if (item.derivedFrom === null) continue;
      expect(byId.get(item.derivedFrom)?.derivedFrom, where(item)).toBe(null);
    }
  });

  it('tells the same story in source and derived_from', () => {
    for (const item of corpus()) {
      if (item.derivedFrom === null) continue;
      expect(item.source, where(item)).toContain(item.derivedFrom);
    }
  });

  it('respects the CKE gate: a material that misses the task scores low everywhere', () => {
    const rubric = loadRubric();
    const gate = rubric.judge[0];
    const others = rubric.judge.slice(1).map((dimension) => dimension.id);

    for (const item of corpus()) {
      if (!gate || item.humanScores[gate.id] !== 1) continue;

      const above = others.filter((id) => (item.humanScores[id] ?? 1) > 1);
      expect(above, `${where(item)} scores 1 on ${gate.id}`).toEqual([]);
    }
  });

  it('resolves every check override against the rubric', () => {
    const rubric = loadRubric();

    for (const item of corpus()) {
      expect(() => checkSpecsFor(rubric, item), where(item)).not.toThrow();
    }
  });
});

describe('the split between train and test', () => {
  it('keeps a base material and its variants on one side', () => {
    const trainFamilies = new Set(train().map(familyOf));
    const leaked = heldOut()
      .filter((item) => trainFamilies.has(familyOf(item)))
      .map((item) => `${where(item)} shares a base with train`);

    expect(leaked).toEqual([]);
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
