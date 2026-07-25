import { readFileSync } from 'node:fs';
import type { CheckParams } from './checks/index.js';
import {
  asRecord,
  fail,
  parseYaml,
  requireArray,
  requireMap,
  requireString,
} from './yaml.js';

export interface RubricCheck {
  id: string;
  description: string;
  params: CheckParams;
}

export interface RubricDimension {
  id: string;
  cke_name: string;
  weight: number;
  description: string;
  scale: string;
  anchors: Record<string, string>;
}

export interface Rubric {
  version: string;
  source?: Record<string, unknown>;
  deterministic: RubricCheck[];
  judge: RubricDimension[];
}

export const RUBRIC_PATH = 'evals/rubric.yaml';

function readCheck(raw: unknown, index: number, file: string): RubricCheck {
  const label = `deterministic[${index}]`;
  const record = requireMap(raw, file, label);

  return {
    id: requireString(record, 'id', file, `${label}.id`),
    description: requireString(
      record,
      'description',
      file,
      `${label}.description`,
    ),
    params: requireMap(record.params, file, `${label}.params`),
  };
}

function readAnchors(
  raw: unknown,
  label: string,
  file: string,
): Record<string, string> {
  const record = requireMap(raw, file, label);
  const anchors: Record<string, string> = {};

  for (const [score, text] of Object.entries(record)) {
    if (typeof text !== 'string' || text.trim().length === 0) {
      fail(file, `${label}.${score} must be a non-empty string`);
    }
    anchors[score] = text;
  }

  if (Object.keys(anchors).length === 0)
    fail(file, `${label} must not be empty`);
  return anchors;
}

function readDimension(
  raw: unknown,
  index: number,
  file: string,
): RubricDimension {
  const label = `judge[${index}]`;
  const record = requireMap(raw, file, label);
  const weight = record.weight;

  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
    fail(file, `${label}.weight must be a positive number`);
  }

  return {
    id: requireString(record, 'id', file, `${label}.id`),
    cke_name: requireString(record, 'cke_name', file, `${label}.cke_name`),
    weight,
    description: requireString(
      record,
      'description',
      file,
      `${label}.description`,
    ),
    scale: requireString(record, 'scale', file, `${label}.scale`),
    anchors: readAnchors(record.anchors, `${label}.anchors`, file),
  };
}

export function parseRubric(source: string, file: string): Rubric {
  const record = requireMap(parseYaml(source, file), file, 'rubric');
  const checks = requireArray(record, 'deterministic', file);
  const dimensions = requireArray(record, 'judge', file);

  if (dimensions.length === 0)
    fail(file, 'judge must list at least one dimension');

  return {
    version: requireString(record, 'version', file),
    source: asRecord(record.source),
    deterministic: checks.map((check, index) => readCheck(check, index, file)),
    judge: dimensions.map((dimension, index) =>
      readDimension(dimension, index, file),
    ),
  };
}

export function loadRubric(path: string = RUBRIC_PATH): Rubric {
  return parseRubric(readFileSync(path, 'utf8'), path);
}
