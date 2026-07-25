# Labeling protocol

How `human_scores` in `evals/dataset/` are assigned. The LLM-judge is calibrated
against these numbers, so the calibration is worth exactly as much as this
procedure is. Written down even though a single person labels the corpus: an
undocumented ground truth cannot be argued with, only believed.

## Status

Two decisions are open and block collection:

- **Provenance of the materials.** Not yet decided — see below.
- **Who labels, and with what standing.** Not yet recorded.

Fill both in before the first item is committed, and state in this file who
decided what and when.

## Provenance and licensing

The repository is public, so every item ships under a licence someone can check.
Each item declares its origin in the `source` field, and the parser rejects an
item without one.

Options, in the order they were considered:

1. **Self-authored materials.** Written for this repository against the CKE task
   formats. No licensing risk, full control over the quality spread, expensive
   in time.
2. **Public CKE samples** from the informator or published exam sheets, cited
   precisely (edition, year, page). Requires reading the licence terms — the
   fact that a document is publicly downloadable does not make redistribution
   permitted.
3. **Real student work.** Only with written consent and after anonymization.
   Even without a name, an exam answer is personal data. Treat as a last resort.

Whichever is chosen, `source` must be specific enough that a reader can verify
the claim.

## Scale and anchors

Dimensions, weights and anchors live in `evals/rubric.yaml`: `content`,
`coherence`, `range`, `accuracy`, each scored 1 to 5 against the anchors written
for 1, 3 and 5. Scores 2 and 4 mean "between these two anchors" — do not invent
criteria for them.

The rubric is the only reference. If an item cannot be scored from the anchors,
the anchors are wrong: fix them in a new rubric version and relabel, rather than
scoring on intuition and moving on.

## Procedure

For each item:

1. Read the `brief`, then the material once, whole, without scoring.
2. Score each dimension against its anchors, in the order they appear in the
   rubric. Anchor first, score second: find the anchor the material matches,
   then decide whether it sits at it or between it and the next.
3. Write the scores into the frontmatter, and record any hesitation in the
   labeling notes below rather than in the item.
4. Leave the item for a day if the score was uncertain, then rescore before
   committing.

Do not read the model output or a previous LLM-judge score before labeling.
Ground truth contaminated by the system it is meant to test measures nothing.

## Self-agreement

A single labeler still drifts. Before the final measurement, relabel a random
sample of at least 5 items from `train/` with the earlier scores hidden, and
report the agreement between the two passes in `docs/calibration.md`.

That number is the ceiling: the judge cannot sensibly be asked to agree with a
person more than the person agrees with themselves.

## Disagreements

If a second labeler ever joins: both score independently, disagreements of one
point are resolved by discussion, disagreements of two or more are recorded in
this file with the reasoning and the final score. Never average the scores — the
average hides exactly the case that would have taught something.

## What goes into the corpus

- at least 12 items in `train/`, at least 6 in `test/`
- more than one `task_type`
- a spread of quality, not only top answers — a corpus of fives cannot calibrate
  anything, since a judge that always answers 5 would score perfectly on it

`npm test` gates the shape of what is committed — parsing, unique ids, a full
set of scores, the deterministic layer on `train/` — but it does not enforce the
counts or the spread, because it would then fail from the first day of
collection to the last. Check both by hand before the calibration run, and say
in `docs/calibration.md` what the corpus actually contained.

## Versioning

Relabeling an item is a commit that says why. Changing the anchors means a new
`rubric.yaml` version and relabeling everything scored against the old ones —
scores from two different rubrics must never sit in one corpus.

## Labeling notes

Items whose scoring was not obvious, with the reasoning. Empty until collection
begins.
