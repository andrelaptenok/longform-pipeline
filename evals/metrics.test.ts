import { describe, expect, it } from 'vitest';
import {
  agreement,
  agreementWithin,
  meanAbsoluteError,
  quadraticWeightedKappa,
  spearmanRho,
} from './metrics.js';

const SCALE = { min: 1, max: 5 };

describe('meanAbsoluteError', () => {
  it('is zero when the judge matches the expert everywhere', () => {
    expect(meanAbsoluteError([1, 3, 5], [1, 3, 5])).toBe(0);
  });

  it('averages the distance, ignoring its direction', () => {
    expect(meanAbsoluteError([3, 3], [1, 5])).toBe(2);
  });
});

describe('agreementWithin', () => {
  const human = [1, 2, 3, 4];
  const judge = [1, 3, 5, 4];

  it('counts only identical scores at tolerance 0', () => {
    expect(agreementWithin(human, judge, 0)).toBe(0.5);
  });

  it('counts neighbours at tolerance 1', () => {
    expect(agreementWithin(human, judge, 1)).toBe(0.75);
  });
});

describe('quadraticWeightedKappa', () => {
  it('is 1 when the judge reproduces a varied set of expert scores', () => {
    expect(
      quadraticWeightedKappa([1, 2, 3, 4, 5], [1, 2, 3, 4, 5], SCALE),
    ).toBe(1);
  });

  it('is 0 when agreement is no better than the marginals predict', () => {
    const human = [1, 1, 5, 5];
    const judge = [1, 5, 1, 5];

    expect(quadraticWeightedKappa(human, judge, SCALE)).toBeCloseTo(0, 10);
  });

  it('goes negative when the judge is systematically inverted', () => {
    expect(
      quadraticWeightedKappa([1, 2, 4, 5], [5, 4, 2, 1], SCALE),
    ).toBeLessThan(0);
  });

  it('punishes a distant disagreement harder than a near one', () => {
    const near = quadraticWeightedKappa([1, 3, 5, 3], [1, 3, 4, 3], SCALE);
    const far = quadraticWeightedKappa([1, 3, 5, 3], [1, 3, 1, 3], SCALE);

    expect(near).toBeGreaterThan(far);
  });

  it('reports perfect agreement on a constant column rather than dividing by zero', () => {
    expect(quadraticWeightedKappa([4, 4, 4], [4, 4, 4], SCALE)).toBe(1);
  });

  it('reports no agreement when only the expert is constant', () => {
    expect(quadraticWeightedKappa([4, 4, 4], [4, 4, 5], SCALE)).toBe(0);
  });
});

describe('spearmanRho', () => {
  it('is 1 for a judge that ranks the corpus the same way', () => {
    expect(spearmanRho([1, 2, 3, 4], [2, 3, 4, 5])).toBeCloseTo(1, 10);
  });

  it('is -1 for a judge that ranks it backwards', () => {
    expect(spearmanRho([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 10);
  });

  it('shares ranks between tied scores', () => {
    expect(spearmanRho([1, 2, 2, 3], [1, 2, 2, 3])).toBeCloseTo(1, 10);
  });

  it('is 0 when one side never varies, since it ranks nothing', () => {
    expect(spearmanRho([3, 3, 3], [1, 2, 3])).toBe(0);
  });
});

describe('agreement', () => {
  it('reports every metric over one set of pairs', () => {
    const result = agreement([1, 2, 3, 4, 5], [1, 2, 3, 4, 5], SCALE);

    expect(result).toMatchObject({
      pairs: 5,
      qwk: 1,
      mae: 0,
      exact: 1,
      withinOne: 1,
    });
    expect(result.spearman).toBeCloseTo(1, 10);
  });

  it('refuses mismatched or empty input rather than inventing a number', () => {
    expect(() => agreement([1, 2], [1], SCALE)).toThrow(
      /one judge score per human score/,
    );
    expect(() => agreement([], [], SCALE)).toThrow(/at least one pair/);
  });
});
