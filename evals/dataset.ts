import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CheckParams } from './checks/types.js';
import { fail, parseYaml, requireMap, requireString } from './yaml.js';

export interface DatasetItem {
  id: string;
  taskType: string;
  brief: string;
  source: string;
  derivedFrom: string | null;
  expected: Record<string, CheckParams>;
  humanScores: Record<string, number>;
  reference: string;
  file: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function readExpected(raw: unknown, file: string): Record<string, CheckParams> {
  if (raw === undefined) return {};
  const record = requireMap(raw, file, 'expected');
  const expected: Record<string, CheckParams> = {};

  for (const [checkId, params] of Object.entries(record)) {
    expected[checkId] = requireMap(params, file, `expected.${checkId}`);
  }

  return expected;
}

function readHumanScores(raw: unknown, file: string): Record<string, number> {
  if (raw === undefined) return {};
  const record = requireMap(raw, file, 'human_scores');
  const scores: Record<string, number> = {};

  for (const [dimension, score] of Object.entries(record)) {
    if (typeof score !== 'number' || !Number.isFinite(score)) {
      fail(file, `human_scores.${dimension} must be a number`);
    }
    scores[dimension] = score;
  }

  return scores;
}

function readDerivedFrom(
  raw: unknown,
  id: string,
  file: string,
): string | null {
  if (raw === undefined || raw === null) return null;

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    fail(file, 'derived_from must be a non-empty string');
  }
  if (raw === id) fail(file, 'derived_from must name another item');

  return raw;
}

export function parseDatasetItem(source: string, file: string): DatasetItem {
  const match = FRONTMATTER.exec(source);
  if (!match?.[1]) fail(file, 'missing YAML frontmatter');

  const meta = requireMap(parseYaml(match[1], file), file, 'frontmatter');
  const reference = source.slice(match[0].length).trim();

  if (reference.length === 0) {
    fail(file, 'the body must carry the gold reference material');
  }

  const id = requireString(meta, 'id', file);

  return {
    id,
    taskType: requireString(meta, 'task_type', file),
    brief: requireString(meta, 'brief', file),
    source: requireString(meta, 'source', file),
    derivedFrom: readDerivedFrom(meta.derived_from, id, file),
    expected: readExpected(meta.expected, file),
    humanScores: readHumanScores(meta.human_scores, file),
    reference,
    file,
  };
}

export function loadDataset(dir: string): DatasetItem[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => {
      const path = join(dir, name);
      return parseDatasetItem(readFileSync(path, 'utf8'), path);
    });
}
