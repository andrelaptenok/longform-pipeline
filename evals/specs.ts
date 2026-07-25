import { runChecks } from './checks/index.js';
import type { CheckParams, CheckResult, CheckSpec } from './checks/types.js';
import type { DatasetItem } from './dataset.js';
import type { Rubric, RubricCheck } from './rubric.js';
import { fail } from './yaml.js';

function paramsFor(check: RubricCheck, item: DatasetItem): CheckParams {
  const overrides = item.expected[check.id];
  if (!overrides) return check.params;

  const known = Object.keys(check.params);
  for (const key of Object.keys(overrides)) {
    if (!known.includes(key)) {
      fail(
        item.file,
        `expected.${check.id}.${key} is not a param of the ${check.id} check (known: ${known.join(', ')})`,
      );
    }
  }

  return { ...check.params, ...overrides };
}

export function checkSpecsFor(rubric: Rubric, item: DatasetItem): CheckSpec[] {
  const known = rubric.deterministic.map((check) => check.id);

  for (const id of Object.keys(item.expected)) {
    if (!known.includes(id)) {
      fail(
        item.file,
        `expected.${id} is not a check in the rubric (known: ${known.join(', ')})`,
      );
    }
  }

  return rubric.deterministic.map((check) => ({
    id: check.id,
    params: paramsFor(check, item),
  }));
}

export function evaluateItem(rubric: Rubric, item: DatasetItem): CheckResult[] {
  return runChecks(item.reference, checkSpecsFor(rubric, item));
}
