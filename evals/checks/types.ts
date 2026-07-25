export type CheckParams = Record<string, unknown>;

export interface CheckResult {
  id: string;
  pass: boolean;
  detail: string;
  observed?: Record<string, unknown>;
}

export type DeterministicCheck = (
  text: string,
  params: CheckParams,
) => CheckResult;

export interface CheckSpec {
  id: string;
  params: CheckParams;
}

export function requireNumber(params: CheckParams, key: string): number {
  const value = params[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`check param "${key}" must be a finite number`);
  }
  return value;
}

export function requireStringArray(
  params: CheckParams,
  key: string,
): readonly string[] {
  const value = params[key];
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new Error(`check param "${key}" must be an array of strings`);
  }
  return value as string[];
}
