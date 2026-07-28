import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadDataset, type DatasetItem } from '../dataset.js';
import { loadRubric } from '../rubric.js';
import { scaleBoundsOf } from '../judge.js';
import { checkSpecsFor, deviations, evaluateItem } from '../specs.js';

const TRAIN = 'evals/dataset/train';
const HELD_OUT = 'evals/dataset/test';
const DRAFTS = 'evals/dataset/drafts';

const train = () => loadDataset(TRAIN);
const heldOut = () => loadDataset(HELD_OUT);
const corpus = () => [...loadDataset(TRAIN), ...loadDataset(HELD_OUT)];
const drafts = () => (existsSync(DRAFTS) ? loadDataset(DRAFTS) : []);
const everything = () => [...corpus(), ...drafts()];

const where = (item: DatasetItem) => `${item.file} (${item.id})`;
const familyOf = (item: DatasetItem) => item.derivedFrom ?? item.id;

describe('the committed corpus', () => {
  it('parses every item in both splits', () => {
    expect(() => loadDataset(TRAIN)).not.toThrow();
    expect(() => loadDataset(HELD_OUT)).not.toThrow();
  });

  it('gives every item a unique id, drafts included', () => {
    const ids = everything().map((item) => item.id);
    expect(ids).toEqual([...new Set(ids)]);
  });

  it('names every file after the id it carries, drafts included', () => {
    for (const item of everything()) {
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
    const bounds = new Map(
      loadRubric().judge.map((dimension) => [
        dimension.id,
        scaleBoundsOf(dimension),
      ]),
    );

    for (const item of corpus()) {
      for (const [dimension, score] of Object.entries(item.humanScores)) {
        const scale = bounds.get(dimension);
        const label = `${where(item)} ${dimension}`;

        expect(scale, label).toBeDefined();
        expect(Number.isInteger(score), label).toBe(true);
        expect(score, label).toBeGreaterThanOrEqual(scale?.min ?? 0);
        expect(score, label).toBeLessThanOrEqual(scale?.max ?? 0);
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

  it('respects the CKE gate: a material that fails the task scores zero everywhere', () => {
    const rubric = loadRubric();
    const gate = rubric.judge[0];
    const others = rubric.judge.slice(1).map((dimension) => dimension.id);

    for (const item of corpus()) {
      if (!gate || item.humanScores[gate.id] !== 0) continue;

      const above = others.filter((id) => (item.humanScores[id] ?? 0) !== 0);
      expect(above, `${where(item)} scores 0 on ${gate.id}`).toEqual([]);
    }
  });

  it('resolves every check override against the rubric', () => {
    const rubric = loadRubric();

    for (const item of corpus()) {
      expect(() => checkSpecsFor(rubric, item), where(item)).not.toThrow();
    }
  });
});

describe('the drafts', () => {
  it('parse and meet the deterministic layer, so labeling is all that is left', () => {
    const rubric = loadRubric();

    for (const item of drafts()) {
      const off = deviations(item, evaluateItem(rubric, item));
      expect(off, where(item)).toEqual([]);
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
  it('fails no deterministic check it did not declare, and declares none it passes', () => {
    const rubric = loadRubric();

    for (const item of train()) {
      const off = deviations(item, evaluateItem(rubric, item));
      expect(off, where(item)).toEqual([]);
    }
  });
});
