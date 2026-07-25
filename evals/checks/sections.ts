import {
  requireStringArray,
  type CheckParams,
  type CheckResult,
  type DeterministicCheck,
} from './types.js';

const MARKDOWN_HEADING = /^\s{0,3}#{1,6}\s+(.+?)\s*$/;
const WHOLE_LINE_LABEL =
  /^\s{0,3}(?:\*\*|__|\*|_)?\s*([^\n*_:]{1,60}?)\s*:\s*(?:\*\*|__|\*|_)?\s*$/;
const MAX_LABEL_WORDS = 4;

function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter((word) => word.length > 0);
}

function sectionWords(line: string): string[] | undefined {
  const heading = MARKDOWN_HEADING.exec(line);
  if (heading?.[1]) {
    const title = words(heading[1]);
    return title.length > 0 ? title : undefined;
  }

  const label = WHOLE_LINE_LABEL.exec(line);
  if (!label?.[1]) return undefined;

  const title = words(label[1]);
  return title.length > 0 && title.length <= MAX_LABEL_WORDS
    ? title
    : undefined;
}

function sectionsOf(text: string): string[][] {
  return text
    .split('\n')
    .map(sectionWords)
    .filter((section): section is string[] => section !== undefined);
}

function mentions(section: string[], name: string[]): boolean {
  if (name.length === 0) return false;
  return section.some((_, start) =>
    name.every((word, offset) => section[start + offset] === word),
  );
}

export function extractSections(text: string): string[] {
  return sectionsOf(text).map((section) => section.join(' '));
}

export const sectionsPresentCheck: DeterministicCheck = (
  text: string,
  params: CheckParams,
): CheckResult => {
  const required = requireStringArray(params, 'required').map(words);
  const sections = sectionsOf(text);

  const missing = required
    .filter((name) => !sections.some((section) => mentions(section, name)))
    .map((name) => name.join(' '));
  const pass = missing.length === 0;

  return {
    id: 'sections_present',
    pass,
    detail: pass
      ? `all ${required.length} required sections present`
      : `missing sections: ${missing.join(', ')}`,
    observed: {
      sections: sections.map((section) => section.join(' ')),
      missing,
    },
  };
};
