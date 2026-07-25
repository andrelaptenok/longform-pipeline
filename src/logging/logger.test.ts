import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RunLogger, type CallRecord } from './logger.js';
import type { GenerateResult } from '../providers/types.js';

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'longform-logger-'));
  path = join(dir, 'nested', 'calls.jsonl');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const result = (overrides: Partial<GenerateResult> = {}): GenerateResult => ({
  text: 'plan',
  usage: { inputTokens: 100, outputTokens: 200 },
  costUsd: 0.5,
  latencyMs: 1200,
  model: 'claude-sonnet-4-6',
  ...overrides,
});

const linesOf = (file: string): CallRecord[] =>
  readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as CallRecord);

describe('RunLogger', () => {
  it('appends one JSONL record per call', () => {
    const logger = new RunLogger(path);

    logger.record('plan', 'plan.v1', result());
    logger.record('revise', 'revise.v2', result({ costUsd: 0.25 }));

    const records = linesOf(path);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      step: 'plan',
      promptVersion: 'plan.v1',
      model: 'claude-sonnet-4-6',
      inputTokens: 100,
      outputTokens: 200,
      costUsd: 0.5,
      latencyMs: 1200,
    });
    expect(records[1]).toMatchObject({ step: 'revise', costUsd: 0.25 });
  });

  it('stamps every record of a run with the same run id', () => {
    const logger = new RunLogger(path);

    logger.record('plan', 'plan.v1', result());
    logger.record('revise', 'revise.v1', result());

    const runIds = linesOf(path).map((record) => record.runId);
    expect(runIds).toEqual([logger.runId, logger.runId]);
  });

  it('gives two runs different ids', () => {
    expect(new RunLogger(path).runId).not.toBe(new RunLogger(path).runId);
  });

  it('creates the directory the log lives in', () => {
    new RunLogger(path).record('plan', 'plan.v1', result());

    expect(linesOf(path)).toHaveLength(1);
  });

  it('totals cost, latency and tokens across the run', () => {
    const logger = new RunLogger(path);

    logger.record('plan', 'plan.v1', result());
    logger.record(
      'revise',
      'revise.v1',
      result({
        usage: { inputTokens: 50, outputTokens: 25 },
        costUsd: 0.25,
        latencyMs: 800,
      }),
    );

    expect(logger.summary()).toEqual({
      runId: logger.runId,
      calls: 2,
      totalCostUsd: 0.75,
      totalLatencyMs: 2000,
      inputTokens: 150,
      outputTokens: 225,
    });
  });

  it('summarizes a run that made no calls as zero, not as absent', () => {
    const logger = new RunLogger(path);

    expect(logger.summary()).toMatchObject({
      calls: 0,
      totalCostUsd: 0,
      totalLatencyMs: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
  });
});
