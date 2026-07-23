import type { Provider } from '../providers/types.js';
import { RunLogger } from '../logging/logger.js';
import { loadPrompt } from './prompts.js';

export interface PipelineInput {
  brief: string;
}

export interface PipelineOutput {
  text: string;
  runId: string;
  summary: ReturnType<RunLogger['summary']>;
}

/**
 * Steps: plan -> sections -> assemble -> revise.
 * Only plan is implemented so far; the rest follow the same pattern.
 */
export async function runPipeline(
  provider: Provider,
  input: PipelineInput,
): Promise<PipelineOutput> {
  const logger = new RunLogger();

  const planPrompt = loadPrompt('plan', 'v1');
  const plan = await provider.generate({
    system: planPrompt.body,
    messages: [{ role: 'user', content: input.brief }],
    maxTokens: 2000,
  });
  logger.record('plan', planPrompt.version, plan);

  return {
    text: plan.text,
    runId: logger.runId,
    summary: logger.summary(),
  };
}
