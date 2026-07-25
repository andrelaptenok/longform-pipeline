import { agreement, type AgreementMetrics } from './metrics.js';
import { scaleBoundsOf, type JudgeVerdict } from './judge.js';
import type { DatasetItem } from './dataset.js';
import type { Rubric } from './rubric.js';

export interface DimensionCalibration extends AgreementMetrics {
  dimension: string;
  skipped: number;
}

export function calibrate(
  rubric: Rubric,
  items: DatasetItem[],
  verdicts: JudgeVerdict[],
): DimensionCalibration[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const seen = new Set<string>();

  for (const verdict of verdicts) {
    if (seen.has(verdict.itemId)) {
      throw new Error(
        `calibration got two verdicts for "${verdict.itemId}"; each item is judged once`,
      );
    }
    seen.add(verdict.itemId);
  }

  return rubric.judge.flatMap((dimension) => {
    const human: number[] = [];
    const judge: number[] = [];
    let skipped = 0;

    for (const verdict of verdicts) {
      const expert = byId.get(verdict.itemId)?.humanScores[dimension.id];
      const scored = verdict.scores[dimension.id]?.score;

      if (expert === undefined || scored === undefined) {
        skipped++;
        continue;
      }

      human.push(expert);
      judge.push(scored);
    }

    if (human.length === 0) return [];

    return [
      {
        dimension: dimension.id,
        skipped,
        ...agreement(human, judge, scaleBoundsOf(dimension)),
      },
    ];
  });
}
