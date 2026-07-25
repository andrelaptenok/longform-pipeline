import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { CheckParams } from './checks/index.js';

export interface DatasetItem {
  id: string;
  taskType: string;
  brief: string;
  expected: Record<string, CheckParams>;
  humanScores: Record<string, number>;
  reference: string;
  file: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function fail(file: string, message: string): never {
  throw new Error(`${file}: ${message}`);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readExpected(raw: unknown, file: string): Record<string, CheckParams> {
  if (raw === undefined) return {};
  const record =
    asRecord(raw) ?? fail(file, 'frontmatter "expected" must be a map');
  const expected: Record<string, CheckParams> = {};

  for (const [checkId, params] of Object.entries(record)) {
    expected[checkId] =
      asRecord(params) ??
      fail(file, `expected.${checkId} must be a map of params`);
  }

  return expected;
}

function readHumanScores(raw: unknown, file: string): Record<string, number> {
  if (raw === undefined) return {};
  const record =
    asRecord(raw) ?? fail(file, 'frontmatter "human_scores" must be a map');
  const scores: Record<string, number> = {};

  for (const [dimension, score] of Object.entries(record)) {
    if (typeof score !== 'number' || !Number.isFinite(score)) {
      fail(file, `human_scores.${dimension} must be a number`);
    }
    scores[dimension] = score;
  }

  return scores;
}

export function parseDatasetItem(source: string, file: string): DatasetItem {
  const match = FRONTMATTER.exec(source);
  if (!match?.[1]) fail(file, 'missing YAML frontmatter');

  const meta =
    asRecord(parse(match[1])) ?? fail(file, 'frontmatter must be a map');
  const { id, task_type: taskType, brief } = meta;

  if (typeof id !== 'string' || id.length === 0)
    fail(file, 'frontmatter "id" is required');
  if (typeof taskType !== 'string' || taskType.length === 0) {
    fail(file, 'frontmatter "task_type" is required');
  }
  if (typeof brief !== 'string' || brief.length === 0) {
    fail(file, 'frontmatter "brief" is required');
  }

  return {
    id,
    taskType,
    brief,
    expected: readExpected(meta.expected, file),
    humanScores: readHumanScores(meta.human_scores, file),
    reference: source.slice(match[0].length).trim(),
    file,
  };
}

export function loadDataset(dir: string): DatasetItem[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) =>
      parseDatasetItem(readFileSync(join(dir, name), 'utf8'), name),
    );
}
