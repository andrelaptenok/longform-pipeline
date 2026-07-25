import {
  requireStringArray,
  type CheckParams,
  type CheckResult,
  type DeterministicCheck,
} from './types.js';

const MARKDOWN_HEADING = /^\s{0,3}#{1,6}\s+(.+?)\s*$/;
const WHOLE_LINE_LABEL =
  /^\s{0,3}(?:\*\*|__|\*|_)?\s*([^\n*_:]{1,60}?)\s*:\s*(?:\*\*|__|\*|_)?\s*$/;

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function extractSections(text: string): string[] {
  const found: string[] = [];

  for (const line of text.split('\n')) {
    const match = MARKDOWN_HEADING.exec(line) ?? WHOLE_LINE_LABEL.exec(line);
    if (match?.[1]) found.push(normalize(match[1]));
  }

  return found;
}

export const sectionsPresentCheck: DeterministicCheck = (
  text: string,
  params: CheckParams,
): CheckResult => {
  const required = requireStringArray(params, 'required').map(normalize);
  const sections = extractSections(text);
  const missing = required.filter(
    (name) => !sections.some((section) => section.includes(name)),
  );
  const pass = missing.length === 0;

  return {
    id: 'sections_present',
    pass,
    detail: pass
      ? `all ${required.length} required sections present`
      : `missing sections: ${missing.join(', ')}`,
    observed: { sections, missing },
  };
};
