import { RunLogger } from '../src/logging/logger.js';
import { loadPrompt } from '../src/pipeline/prompts.js';
import type { Message, Provider } from '../src/providers/types.js';
import type { DatasetItem } from './dataset.js';
import type { Rubric, RubricDimension } from './rubric.js';
import type { ScaleBounds } from './metrics.js';

export interface DimensionVerdict {
  score: number;
  why: string;
}

export interface JudgeVerdict {
  itemId: string;
  promptVersion: string;
  rubricVersion: string;
  scores: Record<string, DimensionVerdict>;
}

export interface JudgeOptions {
  logger?: RunLogger;
  attempts?: number;
  version?: string;
  maxTokens?: number;
}

export function scaleBoundsOf(dimension: RubricDimension): ScaleBounds {
  const match = /^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(dimension.scale);
  if (!match?.[1] || !match?.[2]) {
    throw new Error(
      `judge: dimension "${dimension.id}" has an unreadable scale "${dimension.scale}"`,
    );
  }

  return { min: Number(match[1]), max: Number(match[2]) };
}

export function renderRubric(rubric: Rubric): string {
  const dimensions = rubric.judge.map((dimension) => {
    const anchors = Object.entries(dimension.anchors)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([score, text]) => `  ${score}: ${text}`)
      .join('\n');

    return [
      `${dimension.id} (${dimension.cke_name}), scale ${dimension.scale}`,
      `  ${dimension.description}`,
      anchors,
    ].join('\n');
  });

  return `Rubric ${rubric.version}\n\n${dimensions.join('\n\n')}`;
}

function stripFence(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  return (fenced?.[1] ?? text).trim();
}

function extractObject(text: string): string {
  const body = stripFence(text);
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');

  if (start === -1 || end <= start) {
    throw new Error('judge returned no JSON object');
  }

  return body.slice(start, end + 1);
}

export function parseVerdict(
  text: string,
  rubric: Rubric,
): Record<string, DimensionVerdict> {
  const body = extractObject(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    throw new Error(
      `judge returned unparseable JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('judge returned JSON that is not an object');
  }

  const record = parsed as Record<string, unknown>;
  const scores: Record<string, DimensionVerdict> = {};

  for (const dimension of rubric.judge) {
    const raw = record[dimension.id];
    if (typeof raw !== 'object' || raw === null) {
      throw new Error(`judge left out the dimension "${dimension.id}"`);
    }

    const { score, why } = raw as { score?: unknown; why?: unknown };
    const bounds = scaleBoundsOf(dimension);

    if (
      typeof score !== 'number' ||
      !Number.isInteger(score) ||
      score < bounds.min ||
      score > bounds.max
    ) {
      throw new Error(
        `judge scored "${dimension.id}" as ${JSON.stringify(score)}, outside the integer range ${bounds.min}-${bounds.max}`,
      );
    }
    if (typeof why !== 'string' || why.trim().length === 0) {
      throw new Error(`judge gave no justification for "${dimension.id}"`);
    }

    scores[dimension.id] = { score, why };
  }

  const unknown = Object.keys(record).filter(
    (key) => !Object.hasOwn(scores, key),
  );
  if (unknown.length > 0) {
    throw new Error(`judge invented dimensions: ${unknown.join(', ')}`);
  }

  return scores;
}

export async function judgeItem(
  provider: Provider,
  rubric: Rubric,
  item: DatasetItem,
  options: JudgeOptions = {},
): Promise<JudgeVerdict> {
  const version = options.version ?? 'v1';
  const attempts = options.attempts ?? 2;
  const prompt = loadPrompt('judge', version);
  const system = `${prompt.body}\n\n${renderRubric(rubric)}`;

  const messages: Message[] = [
    {
      role: 'user',
      content: `Task set to the candidate:\n${item.brief}\n\nResponse:\n${item.reference}`,
    },
  ];

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const result = await provider.generate({
      system,
      messages,
      maxTokens: options.maxTokens ?? 2000,
    });
    options.logger?.record(`judge:${item.id}`, prompt.version, result);

    try {
      return {
        itemId: item.id,
        promptVersion: prompt.version,
        rubricVersion: rubric.version,
        scores: parseVerdict(result.text, rubric),
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      messages.push(
        { role: 'assistant', content: result.text },
        {
          role: 'user',
          content: `That reply could not be used: ${lastError.message}. Reply again with JSON only, one key per rubric dimension.`,
        },
      );
    }
  }

  throw new Error(`${item.file}: ${lastError?.message ?? 'judge failed'}`);
}
