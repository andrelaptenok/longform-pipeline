import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { RunLogger } from '../src/logging/logger.js';
import { getProvider } from '../src/providers/index.js';
import type { CheckResult } from './checks/types.js';
import { calibrate, type DimensionCalibration } from './calibration.js';
import { loadDataset, type DatasetItem } from './dataset.js';
import { judgeItem, type JudgeVerdict } from './judge.js';
import { loadRubric, type Rubric } from './rubric.js';
import { evaluateItem } from './specs.js';

const DATASET = 'evals/dataset/train';
const REPORTS = 'evals/reports';

function report(item: DatasetItem, results: CheckResult[]): void {
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${item.id} (${item.taskType}) — ${failed} failed`);
  for (const result of results) {
    console.log(
      `  ${result.pass ? 'PASS' : 'FAIL'} ${result.id}: ${result.detail}`,
    );
  }
}

function reportCalibration(rows: DimensionCalibration[]): void {
  console.log('\nJudge against the expert:');
  for (const row of rows) {
    console.log(
      `  ${row.dimension}: QWK ${row.qwk.toFixed(2)}, MAE ${row.mae.toFixed(2)}, exact ${(row.exact * 100).toFixed(0)}%, within 1 ${(row.withinOne * 100).toFixed(0)}% (n=${row.pairs}${row.skipped > 0 ? `, ${row.skipped} unlabeled` : ''})`,
    );
  }
}

async function runJudge(rubric: Rubric, dataset: DatasetItem[]) {
  const provider = getProvider(process.env.PROVIDER ?? 'claude');
  const logger = new RunLogger('judge');
  const verdicts: JudgeVerdict[] = [];

  console.log(`\nJudging ${dataset.length} items with ${provider.model}...`);
  for (const item of dataset) {
    verdicts.push(await judgeItem(provider, rubric, item, { logger }));
  }

  const calibration = calibrate(rubric, dataset, verdicts);
  if (calibration.length > 0) reportCalibration(calibration);

  const summary = logger.summary();
  console.log(
    `\nJudge run ${summary.runId}: ${summary.calls} calls, $${summary.totalCostUsd.toFixed(4)}`,
  );

  return { verdicts, calibration, summary };
}

async function main() {
  const rubric = loadRubric();
  const dataset = loadDataset(DATASET);
  const withJudge = process.argv.includes('--judge');

  if (dataset.length === 0) {
    console.error(
      'Dataset is empty. Put reference materials in evals/dataset/train/*.md',
    );
  }

  const results = dataset.map((item) => {
    const checks = evaluateItem(rubric, item);
    report(item, checks);
    return {
      id: item.id,
      file: item.file,
      taskType: item.taskType,
      deterministic: checks,
      pass: checks.every((check) => check.pass),
    };
  });

  const passed = results.filter((r) => r.pass).length;
  if (dataset.length > 0) {
    console.log(
      `\nDeterministic checks: ${passed}/${results.length} items passed`,
    );
  }
  if (passed < results.length || dataset.length === 0) process.exitCode = 1;

  const judge =
    withJudge && dataset.length > 0
      ? await runJudge(rubric, dataset)
      : undefined;

  const output = {
    timestamp: new Date().toISOString(),
    rubricVersion: rubric.version,
    datasetSize: dataset.length,
    results,
    judge,
  };

  mkdirSync(REPORTS, { recursive: true });
  const path = join(REPORTS, `eval-${Date.now()}.json`);
  writeFileSync(path, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Report: ${path}`);
}

await main();
