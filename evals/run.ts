import 'dotenv/config';
import { appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { RunLogger } from '../src/logging/logger.js';
import { getProvider } from '../src/providers/index.js';
import type { CheckResult } from './checks/types.js';
import { calibrate, type DimensionCalibration } from './calibration.js';
import { loadDataset, type DatasetItem } from './dataset.js';
import { judgeItem, type JudgeVerdict } from './judge.js';
import { loadRubric, type Rubric } from './rubric.js';
import { deviations, evaluateItem } from './specs.js';

const DATASET = 'evals/dataset/train';
const REPORTS = 'evals/reports';

interface JudgeFailure {
  itemId: string;
  file: string;
  error: string;
}

function report(
  item: DatasetItem,
  results: CheckResult[],
  off: string[],
): void {
  const declared = new Set(item.expectedFailures);
  console.log(`\n${item.id} (${item.taskType}) — ${off.length} unaccounted`);

  for (const result of results) {
    const verdict = result.pass
      ? 'PASS'
      : declared.has(result.id)
        ? 'FAIL (declared)'
        : 'FAIL';
    console.log(`  ${verdict} ${result.id}: ${result.detail}`);
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
  const trail = join(REPORTS, `verdicts-${logger.runId}.jsonl`);
  const verdicts: JudgeVerdict[] = [];
  const failures: JudgeFailure[] = [];

  console.log(`\nJudging ${dataset.length} items with ${provider.model}...`);

  for (const item of dataset) {
    try {
      const verdict = await judgeItem(provider, rubric, item, { logger });
      verdicts.push(verdict);
      appendFileSync(trail, JSON.stringify(verdict) + '\n', 'utf8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ itemId: item.id, file: item.file, error: message });
      console.error(`  UNJUDGED ${item.id}: ${message}`);
    }
  }

  const calibration = calibrate(rubric, dataset, verdicts);
  if (calibration.length > 0) reportCalibration(calibration);

  const summary = logger.summary();
  console.log(
    `\nJudge run ${summary.runId}: ${verdicts.length}/${dataset.length} items judged, ${summary.calls} calls, $${summary.totalCostUsd.toFixed(4)}`,
  );
  if (verdicts.length > 0) console.log(`Verdicts: ${trail}`);
  if (failures.length > 0) {
    console.error(
      `${failures.length} items could not be judged; they are listed in the report below`,
    );
    process.exitCode = 1;
  }

  return { trail, verdicts, failures, calibration, summary };
}

async function main() {
  const rubric = loadRubric();
  const dataset = loadDataset(DATASET);
  const withJudge = process.argv.includes('--judge');
  const force = process.argv.includes('--force');

  if (dataset.length === 0) {
    console.error(
      'Dataset is empty. Put reference materials in evals/dataset/train/*.md',
    );
  }

  const results = dataset.map((item) => {
    const checks = evaluateItem(rubric, item);
    const off = deviations(item, checks);
    report(item, checks, off);
    return {
      id: item.id,
      file: item.file,
      taskType: item.taskType,
      deterministic: checks,
      declaredFailures: item.expectedFailures,
      deviations: off,
      pass: off.length === 0,
    };
  });

  const passed = results.filter((r) => r.pass).length;
  if (dataset.length > 0) {
    console.log(
      `\nDeterministic checks: ${passed}/${results.length} items behave as declared`,
    );
  }
  if (passed < results.length || dataset.length === 0) process.exitCode = 1;

  const output: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    rubricVersion: rubric.version,
    datasetSize: dataset.length,
    results,
  };

  try {
    if (withJudge && dataset.length > 0) {
      if (passed < results.length && !force) {
        console.error(
          `\nNot judging: ${results.length - passed} items deviate from the deterministic layer in ways they do not declare, so the calibration would measure a corpus that is known to be wrong. Fix them, declare the failure in expected_failures, or rerun with --force.`,
        );
      } else {
        output.judge = await runJudge(rubric, dataset);
      }
    }
  } finally {
    mkdirSync(REPORTS, { recursive: true });
    const path = join(REPORTS, `eval-${Date.now()}.json`);
    writeFileSync(path, JSON.stringify(output, null, 2), 'utf8');
    console.log(`Report: ${path}`);
  }
}

await main();
