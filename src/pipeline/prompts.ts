import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROMPTS_DIR = 'prompts';

export interface LoadedPrompt {
  version: string;
  body: string;
}

/**
 * Prompts live as files rather than inline strings so the eval system can
 * say "version v2 is N% worse than v1".
 */
export function loadPrompt(name: string, version: string): LoadedPrompt {
  const path = join(PROMPTS_DIR, `${name}.${version}.md`);
  return { version: `${name}.${version}`, body: readFileSync(path, 'utf8') };
}
