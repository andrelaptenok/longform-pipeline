import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { GenerateResult } from '../providers/types.js';

export interface CallRecord {
  runId: string;
  step: string;
  promptVersion: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  timestamp: string;
}

export class RunLogger {
  readonly runId = randomUUID();
  private readonly records: CallRecord[] = [];

  constructor(private readonly path = 'evals/reports/calls.jsonl') {
    mkdirSync(dirname(this.path), { recursive: true });
  }

  record(step: string, promptVersion: string, result: GenerateResult): void {
    const entry: CallRecord = {
      runId: this.runId,
      step,
      promptVersion,
      model: result.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      costUsd: result.costUsd,
      latencyMs: result.latencyMs,
      timestamp: new Date().toISOString(),
    };
    this.records.push(entry);
    appendFileSync(this.path, JSON.stringify(entry) + '\n', 'utf8');
  }

  summary() {
    return {
      runId: this.runId,
      calls: this.records.length,
      totalCostUsd: this.records.reduce((s, r) => s + r.costUsd, 0),
      totalLatencyMs: this.records.reduce((s, r) => s + r.latencyMs, 0),
      inputTokens: this.records.reduce((s, r) => s + r.inputTokens, 0),
      outputTokens: this.records.reduce((s, r) => s + r.outputTokens, 0),
    };
  }
}
