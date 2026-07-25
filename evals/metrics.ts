export interface ScaleBounds {
  min: number;
  max: number;
}

export interface AgreementMetrics {
  pairs: number;
  qwk: number;
  mae: number;
  exact: number;
  withinOne: number;
  spearman: number;
}

function requirePairs(human: number[], judge: number[]): void {
  if (human.length !== judge.length) {
    throw new Error(
      `metrics need one judge score per human score (got ${human.length} and ${judge.length})`,
    );
  }
  if (human.length === 0) throw new Error('metrics need at least one pair');
}

export function meanAbsoluteError(human: number[], judge: number[]): number {
  requirePairs(human, judge);

  const total = human.reduce(
    (sum, value, index) => sum + Math.abs(value - (judge[index] ?? 0)),
    0,
  );
  return total / human.length;
}

export function agreementWithin(
  human: number[],
  judge: number[],
  tolerance: number,
): number {
  requirePairs(human, judge);

  const hits = human.filter(
    (value, index) => Math.abs(value - (judge[index] ?? 0)) <= tolerance,
  ).length;
  return hits / human.length;
}

function requireWithin(
  values: number[],
  scale: ScaleBounds,
  side: string,
): void {
  const stray = values.find(
    (value) =>
      !Number.isInteger(value) || value < scale.min || value > scale.max,
  );

  if (stray !== undefined) {
    throw new Error(
      `${side} score ${stray} is not a whole number on the scale ${scale.min}-${scale.max}`,
    );
  }
}

export function quadraticWeightedKappa(
  human: number[],
  judge: number[],
  scale: ScaleBounds,
): number {
  requirePairs(human, judge);
  requireWithin(human, scale, 'human');
  requireWithin(judge, scale, 'judge');

  const levels = scale.max - scale.min + 1;
  if (levels < 2) throw new Error('a scale needs at least two levels');

  const index = (value: number) => value - scale.min;
  const weight = (a: number, b: number) => (a - b) ** 2 / (levels - 1) ** 2;

  const humanCounts = new Array<number>(levels).fill(0);
  const judgeCounts = new Array<number>(levels).fill(0);
  let observed = 0;

  human.forEach((value, position) => {
    const other = judge[position] ?? scale.min;
    humanCounts[index(value)] = (humanCounts[index(value)] ?? 0) + 1;
    judgeCounts[index(other)] = (judgeCounts[index(other)] ?? 0) + 1;
    observed += weight(index(value), index(other));
  });

  let expected = 0;
  for (let a = 0; a < levels; a++) {
    for (let b = 0; b < levels; b++) {
      expected +=
        ((humanCounts[a] ?? 0) * (judgeCounts[b] ?? 0) * weight(a, b)) /
        human.length;
    }
  }

  if (expected === 0) return observed === 0 ? 1 : 0;
  return 1 - observed / expected;
}

function averageRanks(values: number[]): number[] {
  const order = values
    .map((value, position) => ({ value, position }))
    .sort((a, b) => a.value - b.value);

  const ranks = new Array<number>(values.length).fill(0);
  let start = 0;

  while (start < order.length) {
    let end = start;
    while (
      end + 1 < order.length &&
      order[end + 1]?.value === order[start]?.value
    ) {
      end++;
    }

    const shared = (start + end) / 2 + 1;
    for (let i = start; i <= end; i++) {
      const entry = order[i];
      if (entry) ranks[entry.position] = shared;
    }
    start = end + 1;
  }

  return ranks;
}

export function spearmanRho(human: number[], judge: number[]): number {
  requirePairs(human, judge);

  const humanRanks = averageRanks(human);
  const judgeRanks = averageRanks(judge);
  const mean = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;

  const humanMean = mean(humanRanks);
  const judgeMean = mean(judgeRanks);

  let covariance = 0;
  let humanVariance = 0;
  let judgeVariance = 0;

  humanRanks.forEach((rank, position) => {
    const other = judgeRanks[position] ?? 0;
    covariance += (rank - humanMean) * (other - judgeMean);
    humanVariance += (rank - humanMean) ** 2;
    judgeVariance += (other - judgeMean) ** 2;
  });

  if (humanVariance === 0 || judgeVariance === 0) return 0;
  return covariance / Math.sqrt(humanVariance * judgeVariance);
}

export function agreement(
  human: number[],
  judge: number[],
  scale: ScaleBounds,
): AgreementMetrics {
  return {
    pairs: human.length,
    qwk: quadraticWeightedKappa(human, judge, scale),
    mae: meanAbsoluteError(human, judge),
    exact: agreementWithin(human, judge, 0),
    withinOne: agreementWithin(human, judge, 1),
    spearman: spearmanRho(human, judge),
  };
}
