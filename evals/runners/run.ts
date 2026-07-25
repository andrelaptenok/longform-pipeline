import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CheckResult } from '../checks/index.js';
import { loadDataset, type DatasetItem } from '../dataset.js';
import { loadRubric } from '../rubric.js';
import { evaluateItem } from '../specs.js';

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

async function main() {
  const rubric = loadRubric();
  const dataset = loadDataset(DATASET);

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

  const output = {
    timestamp: new Date().toISOString(),
    rubricVersion: rubric.version,
    datasetSize: dataset.length,
    results,
  };

  mkdirSync(REPORTS, { recursive: true });
  const path = join(REPORTS, `eval-${Date.now()}.json`);
  writeFileSync(path, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Report: ${path}`);
}

await main();
