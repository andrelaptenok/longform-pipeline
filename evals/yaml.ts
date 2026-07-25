import { parse } from 'yaml';

export function fail(file: string, message: string): never {
  throw new Error(`${file}: ${message}`);
}

export function parseYaml(source: string, file: string): unknown {
  try {
    return parse(source);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message.split('\n')[0] : String(error);
    fail(file, `invalid YAML: ${reason}`);
  }
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function requireMap(
  value: unknown,
  file: string,
  label: string,
): Record<string, unknown> {
  return asRecord(value) ?? fail(file, `${label} must be a map`);
}

export function requireString(
  record: Record<string, unknown>,
  key: string,
  file: string,
  label: string = key,
): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(file, `${label} must be a non-empty string`);
  }
  return value;
}

export function requireArray(
  record: Record<string, unknown>,
  key: string,
  file: string,
  label: string = key,
): unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) fail(file, `${label} must be an array`);
  return value;
}
