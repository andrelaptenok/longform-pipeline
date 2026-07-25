import { describe, expect, it } from 'vitest';
import { parseDatasetItem } from './dataset.js';

const ITEM = `---
id: informal-email-01
task_type: informal_email
brief: 'Write an informal email to a friend about a trip you took.'
source: self-authored
expected:
  length: { min_words: 80, max_words: 130 }
  sections_present: { required: [greeting, body, closing] }
human_scores: { content: 5, coherence: 4 }
---

# Greeting

Hi Tom!
`;

describe('parseDatasetItem', () => {
  it('reads the frontmatter fields', () => {
    const item = parseDatasetItem(ITEM, 'informal-email-01.md');

    expect(item.id).toBe('informal-email-01');
    expect(item.taskType).toBe('informal_email');
    expect(item.brief).toMatch(/informal email/);
    expect(item.source).toBe('self-authored');
    expect(item.derivedFrom).toBeNull();
    expect(item.expected.length).toEqual({ min_words: 80, max_words: 130 });
    expect(item.humanScores).toEqual({ content: 5, coherence: 4 });
    expect(item.file).toBe('informal-email-01.md');
  });

  it('keeps the body as the reference material, without the frontmatter', () => {
    const item = parseDatasetItem(ITEM, 'item.md');

    expect(item.reference).toBe('# Greeting\n\nHi Tom!');
  });

  it('defaults the optional maps to empty', () => {
    const minimal = '---\nid: a\ntask_type: t\nbrief: b\nsource: s\n---\ntext';
    const item = parseDatasetItem(minimal, 'item.md');

    expect(item.expected).toEqual({});
    expect(item.humanScores).toEqual({});
  });

  it('names the file when frontmatter is missing', () => {
    expect(() => parseDatasetItem('just text', 'broken.md')).toThrow(
      /broken\.md: missing YAML frontmatter/,
    );
  });

  it('rejects an item without an id', () => {
    expect(() =>
      parseDatasetItem(
        '---\ntask_type: t\nbrief: b\nsource: s\n---\ntext',
        'x.md',
      ),
    ).toThrow(/x\.md: id must be a non-empty string/);
  });

  it('rejects an item whose body carries no reference material', () => {
    expect(() =>
      parseDatasetItem(
        '---\nid: a\ntask_type: t\nbrief: b\nsource: s\n---\n\n  \n',
        'x.md',
      ),
    ).toThrow(/x\.md: the body must carry the gold reference material/);
  });

  it('rejects an item that does not declare where it came from', () => {
    expect(() =>
      parseDatasetItem('---\nid: a\ntask_type: t\nbrief: b\n---\ntext', 'x.md'),
    ).toThrow(/x\.md: source must be a non-empty string/);
  });

  it('reads the base a variant was degraded from', () => {
    const variant = parseDatasetItem(
      "---\nid: b\ntask_type: t\nbrief: b\nsource: 'self-authored, degraded from a: coherence'\nderived_from: a\n---\ntext",
      'b.md',
    );

    expect(variant.derivedFrom).toBe('a');
  });

  it('rejects an item derived from itself', () => {
    expect(() =>
      parseDatasetItem(
        '---\nid: a\ntask_type: t\nbrief: b\nsource: s\nderived_from: a\n---\ntext',
        'x.md',
      ),
    ).toThrow(/x\.md: derived_from must name another item/);
  });

  it('rejects a derived_from that is not a name', () => {
    expect(() =>
      parseDatasetItem(
        '---\nid: a\ntask_type: t\nbrief: b\nsource: s\nderived_from: 12\n---\ntext',
        'x.md',
      ),
    ).toThrow(/derived_from must be a non-empty string/);
  });

  it('rejects non-numeric human scores', () => {
    const bad =
      '---\nid: a\ntask_type: t\nbrief: b\nsource: s\nhuman_scores: { content: good }\n---\ntext';
    expect(() => parseDatasetItem(bad, 'x.md')).toThrow(
      /human_scores.content must be a number/,
    );
  });

  it('prefixes a YAML syntax error with the file', () => {
    const bad = '---\nbrief: [unclosed\n---\ntext';
    expect(() => parseDatasetItem(bad, 'x.md')).toThrow(/x\.md: invalid YAML/);
  });
});
