import 'dotenv/config';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const DATASET = 'evals/dataset/train';
const REPORTS = 'evals/reports';

interface Rubric {
  version: string;
  deterministic: Array<{
    id: string;
    description: string;
    params: Record<string, unknown>;
  }>;
  judge: Array<{
    id: string;
    weight: number;
    description: string;
    scale: string;
  }>;
}

function loadRubric(): Rubric {
  return parse(readFileSync('evals/rubric.yaml', 'utf8')) as Rubric;
}

function loadDataset(): Array<{ name: string; content: string }> {
  return readdirSync(DATASET)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ name: f, content: readFileSync(join(DATASET, f), 'utf8') }));
}

/**
 * Run scaffold. Later stages add here:
 *  - deterministic checks from rubric.deterministic
 *  - LLM-as-judge from rubric.judge, calibrated against reference materials
 *  - comparison against the previous run (regressions)
 */
async function main() {
  const rubric = loadRubric();
  const dataset = loadDataset();

  const report = {
    timestamp: new Date().toISOString(),
    rubricVersion: rubric.version,
    datasetSize: dataset.length,
    results: [] as unknown[],
  };

  if (dataset.length === 0) {
    console.error(
      'Dataset is empty. Put reference materials in evals/dataset/train/*.md',
    );
  }

  mkdirSync(REPORTS, { recursive: true });
  const path = join(REPORTS, `eval-${Date.now()}.json`);
  writeFileSync(path, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Report: ${path}`);
}

await main();
