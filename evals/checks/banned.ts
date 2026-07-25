import {
  requireStringArray,
  type CheckParams,
  type CheckResult,
  type DeterministicCheck,
} from './types.js';

function compileCaseInsensitive(pattern: string): RegExp {
  try {
    return new RegExp(pattern, 'iu');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `invalid banned pattern ${JSON.stringify(pattern)}: ${reason}`,
    );
  }
}

export const bannedConstructionsCheck: DeterministicCheck = (
  text: string,
  params: CheckParams,
): CheckResult => {
  const patterns = requireStringArray(params, 'patterns');
  const matched = patterns.filter((pattern) =>
    compileCaseInsensitive(pattern).test(text),
  );
  const pass = matched.length === 0;

  return {
    id: 'banned_constructions',
    pass,
    detail: pass
      ? `none of the ${patterns.length} banned patterns matched`
      : `banned patterns matched: ${matched.join(', ')}`,
    observed: { matched },
  };
};
