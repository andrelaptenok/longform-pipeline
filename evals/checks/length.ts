import {
  requireNumber,
  type CheckParams,
  type CheckResult,
  type DeterministicCheck,
} from './types.js';

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

export function countWords(text: string): number {
  return text.match(WORD)?.length ?? 0;
}

export const lengthCheck: DeterministicCheck = (
  text: string,
  params: CheckParams,
): CheckResult => {
  const min = requireNumber(params, 'min_words');
  const max = requireNumber(params, 'max_words');
  const words = countWords(text);
  const pass = words >= min && words <= max;

  return {
    id: 'length',
    pass,
    detail: `${words} words, ${pass ? 'within' : 'outside'} [${min}, ${max}]`,
    observed: { words, min, max },
  };
};
