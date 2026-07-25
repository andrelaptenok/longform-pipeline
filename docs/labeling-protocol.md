# Labeling protocol

How `human_scores` in `evals/dataset/` are assigned. The LLM-judge is calibrated
against these numbers, so the calibration is worth exactly as much as this
procedure is. Written down even though a single person labels the corpus: an
undocumented ground truth cannot be argued with, only believed.

## Status

**Provenance — decided on 2026-07-25 by the repository owner.** Materials are
self-authored, and the quality spread comes from controlled degradation of them
(below). Nothing is taken from CKE sheets or from student work, so the corpus
carries no licensing and no personal-data exposure.

**Who labels — still to be recorded.** The owner is the single labeler. What
this file still needs is one sentence on the standing behind that: what makes
these scores worth calibrating a judge against. Until a second labeler joins,
the self-agreement pass below is the only check on drift, and it belongs in
`docs/calibration.md` next to the judge's own numbers.

## Provenance and licensing

The repository is public, so every item ships under a licence someone can check.
Each item declares its origin in the `source` field, and the parser rejects an
item without one.

Options considered, and why the chosen one won:

1. **Self-authored materials — chosen.** Written for this repository against the
   CKE task formats. No licensing risk, full control over the quality spread.
   Expensive in time, and writing a convincingly weak answer is harder than
   writing a strong one — which is what the degradation scheme below is for.
2. **Public CKE samples** from the informator or published exam sheets, cited
   precisely (edition, year, page). Rejected on two counts: publicly
   downloadable does not mean redistributable without reading the licence, and
   published sample answers are model answers, so they carry no quality spread.
3. **Real student work.** Rejected: even anonymized, an exam answer is personal
   data, and consent is a cost the project does not need to pay for the spread
   it gets from degradation.
4. **Model-generated materials.** Rejected as a basis. Cheap and easy to vary,
   but models fail differently from learners — they rarely make the
   L1-interference errors a Polish candidate makes, and instead produce fluent,
   empty text. A judge calibrated on that measures agreement on a distribution
   the exam does not contain.

`source` values follow one of two forms, so the origin of every item is
machine-readable at a glance:

- `self-authored` — a base material.
- `self-authored, degraded from <base id>: <dimension>` — a variant, naming the
  item it came from and the dimension the defect targets.

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

When the item is a degraded variant, do not open the base material's scores
while scoring it. The base is an anchor you cannot un-see, and scores copied
down from it record what you intended the defect to cost rather than what it
actually cost.

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

### Controlled degradation

The spread is built, not collected. Write one strong material per task type,
then derive variants from it by introducing one defect at a time:

| Defect introduced                                                   | Dimension it targets |
| ------------------------------------------------------------------- | -------------------- |
| Drop a required element of the task, or drift off the brief         | `content`            |
| Reorder paragraphs, strip the linking words                         | `coherence`          |
| Replace varied lexis and structures with repetitive elementary ones | `range`              |
| Introduce a systematic error class (articles, tenses, prepositions) | `accuracy`           |

Two rules make this defensible rather than convenient:

- **Score the variant on its own merits, not by arithmetic.** Knowing which
  defect was introduced tells you which dimension to look at; it does not tell
  you the number. Read the variant against the anchors as if you had not written
  it, and expect a defect to move neighbouring dimensions too — text with the
  connectives stripped often reads as thinner in `range` as well.
- **`test/` shares no base material with `train/`.** A held-out item that is a
  variant of a training item is not held out. Write the test bases separately,
  on different topics.

The variants of one base are near-duplicates of each other, so agreement
measured across them is optimistic: the judge sees the same text repeatedly with
one thing changed. Report this in `docs/calibration.md` alongside the numbers,
and where it matters, report agreement over base materials separately from
agreement over the full set.

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
