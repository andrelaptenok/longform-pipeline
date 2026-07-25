import { bannedConstructionsCheck } from './banned.js';
import { lengthCheck } from './length.js';
import { sectionsPresentCheck } from './sections.js';
import type { CheckResult, CheckSpec, DeterministicCheck } from './types.js';

export const CHECKS: Readonly<Record<string, DeterministicCheck>> = {
  length: lengthCheck,
  sections_present: sectionsPresentCheck,
  banned_constructions: bannedConstructionsCheck,
};

export function getCheck(id: string): DeterministicCheck {
  const check = CHECKS[id];
  if (!check) {
    const known = Object.keys(CHECKS).join(', ');
    throw new Error(`unknown deterministic check "${id}" (known: ${known})`);
  }
  return check;
}

export function runChecks(text: string, specs: CheckSpec[]): CheckResult[] {
  return specs.map((spec) => getCheck(spec.id)(text, spec.params));
}
