---
id: informal-email-01
task_type: informal_email
brief: 'Write an informal email to a friend about a trip you took.'
source: self-authored
expected:
  length: { min_words: 200, max_words: 250 }
  sections_present: { required: [greeting, body, closing] }
human_scores: { content: 5, coherence: 4, range: 4, accuracy: 5 }
---

The gold reference material goes here — the full text a top answer would look
like, in the format the brief asks for.

Copy this file into `drafts/` while the material is being written, then into
`train/` or `test/` once it carries `human_scores`. The file name has to match
its `id` — the corpus gate checks that they agree. `derived_from`,
`expected` and `human_scores` are the optional fields; the last two are needed
before an item counts as labeled.

- `source` — where the material came from, in one of two forms:
  `self-authored` for a base material, or
  `self-authored, degraded from <base id>: <dimension>` for a variant derived
  from one. This repository is public, so the origin has to be checkable.
- `derived_from` — omitted on a base material; on a variant, the `id` of the
  base it was degraded from. This is the machine-readable half of `source`, and
  the gate holds the two to the same story. It also keeps a base and its
  variants on one side of the train/test split: a held-out item derived from a
  training one is not held out.
- `expected` — per-check overrides, keyed by check id, layered over the
  defaults in `rubric.yaml`. Drop a key to keep the default; a key that names no
  check, or a param that check does not have, is an error rather than a shrug.
  A list replaces the default list instead of extending it, so
  `banned_constructions: { patterns: [] }` disables the check for this item —
  write it only when that is what you mean.
- `human_scores` — the expert scores, one per judge dimension in `rubric.yaml`,
  each 1 to 5, assigned against the anchors there. This is the ground truth the
  LLM-judge is calibrated against, so it is scored by a person reading the
  anchors, never by a model.

`docs/labeling-protocol.md` describes how the scores are assigned and how a
variant is derived. `npm test` checks that every committed item parses, carries
a full set of scores, keeps its family on one side of the split, and — in
`train/` — passes the deterministic layer.
