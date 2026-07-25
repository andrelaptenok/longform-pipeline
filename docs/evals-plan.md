# Evals vertical — plan (steps 1–3)

Roadmap for taking the eval system from scaffold to a single measurable result:
the agreement between the LLM-as-judge and a human expert. This is the vertical
that gives the project its point; breadth (more pipeline steps, more providers,
RAG) comes after.

Builds on what already exists: the `Rubric` type in `evals/runners/run.ts`, the
`Provider` interface, `RunLogger`, and the v0 `evals/rubric.yaml`.

## Frame: the dataset unit

The central decision is the shape of a dataset item. A single markdown file with
YAML frontmatter carries everything all three steps need:

```markdown
---
id: informal-email-01
task_type: informal_email
brief: 'Write an informal email to a friend about a trip you took.'
expected:
  length: { min_words: 80, max_words: 130 }
  sections_present: { required: [greeting, body, closing] }
human_scores: { content: 5, coherence: 4, range: 4, accuracy: 5 } # ground truth
---

<gold reference material>
```

- `brief` — pipeline input.
- `expected` — parameters for the deterministic checks (step 1).
- `human_scores` — ground truth for calibrating the judge (step 3).
- body — the gold reference (few-shot anchor and object of scoring).

Parsed with `yaml` (already a dependency) plus a frontmatter split. Everything
lives under `evals/`; `tsconfig` already includes `evals/**/*.ts`.

## Step 1 — Deterministic checks

**Goal.** The three checks from `rubric.yaml` as pure, testable functions, wired
into the runner.

**Files.**

- `evals/checks/types.ts` — `CheckResult { id, pass, detail, observed? }`,
  `DeterministicCheck = (text, params) => CheckResult`.
- `evals/checks/length.ts` / `sections.ts` / `banned.ts` — one per check.
- `evals/checks/index.ts` — registry `id -> DeterministicCheck`; the rubric
  drives which checks run.

**Logic.**

- `length` — word count; pass if within `[min_words, max_words]`;
  `observed: { words }`.
- `sections_present` — detect headings (markdown `#` / labels), match against
  `required` case-insensitively.
- `banned_constructions` — `patterns` as regex; pass if nothing matches.

**Tests.** Add `vitest` (no test framework yet) and `evals/checks/*.test.ts`
with pass/fail fixtures. A `test` script goes into CI.

**Done when.** Checks implemented and unit-tested; the runner prints per-item
deterministic results; `npm test` is green in CI.

Fast, few external dependencies — taken first for early visible progress.

## Step 2 — Corpus + rubric (the long pole)

**Goal.** Real data and a real rubric. This is the bottleneck of the whole
vertical — collection and labeling, not code.

**`rubric.yaml`.** Replace the generic dimensions (`structure/style/task_fit`)
with CKE-aligned ones: `content`, `coherence`, `range`, `accuracy` — with
weights following the CKE point split and **score anchors** (what 1 vs 3 vs 5
means for each). Fill deterministic params with per-`task_type` defaults.

**Corpus.**

- At least 12 labeled materials in `train/`, at least 6 in `test/` (held out
  until the final run).
- Spread across task types and quality levels — not only top scores, or there is
  nothing to calibrate against.
- **Provenance / licensing.** Real exam texts carry copyright risk in a public
  repo. Use self-authored materials or public CKE samples with attribution.
  Decide this before collecting.
- **Labeling protocol** documented in `docs/` (who assigned `human_scores`,
  against which anchors, how disagreements were resolved). A written protocol —
  even for a single labeler — is what makes the ground truth defensible.

**Done when.** `rubric.yaml` is populated (CKE dimensions + weights + anchors);
at least 12 train / 6 test labeled items are committed; the labeling protocol is
in `docs/`.

## Step 3 — LLM-judge + calibration (the headline)

**Goal.** A judge that scores a material against the rubric, and a report on how
well it agrees with the human expert — the artifact that sells the project.

**Judge.**

- `prompts/judge.v1.md` — given a material plus dimension descriptions and
  anchors, returns per-dimension scores 1–5 with a short justification, as
  strict JSON.
- Called through `Provider.generate` (low temperature), JSON parsed with retry,
  and the call **logged via `RunLogger`** — this also tracks the cost of the
  evals themselves.

**Metrics** (`evals/metrics.ts`, pure and unit-tested) on the ordinal 1–5 scale:

- **QWK (quadratic-weighted kappa)** — the headline agreement metric for ordinal
  rubrics.
- MAE, exact and within-±1 accuracy, Spearman rho.

**Train/test discipline.** Metrics are computed on `train` only; iterate the
judge prompt (`v2`, `v3`, ...) until it clears the threshold. `test` is touched
**once**, after the judge is frozen, for a single honest final run.

**Threshold set upfront.** For example, QWK >= 0.6 per dimension on test. Below
that the judge is not ready — not "good enough". An explicit threshold is the
rigor.

**Done when.** The judge is implemented and logged; calibration is computed on
train, the judge is frozen, and the final test run is done; `docs/calibration.md`
reports QWK/MAE per dimension with an honest reading — including where the judge
diverges from the expert and why.

## Order and dependencies

- **Step 2 starts first** — data is the long pole and runs in parallel with the
  code.
- **Step 1** is independent (developed on fixtures) and fast — an early green CI.
- **Step 3** depends on the labeled corpus from step 2 plus `Provider`.
- Recommended sequence: `2 (start collecting) -> 1 -> 3`.

## Cross-cutting

- Extend the `Rubric` type (weights, dimension anchors); move it out of `run.ts`
  into `evals/rubric.ts`.
- `vitest` + a `test` script + a step in `ci.yml`.
- Reuse `Provider` and `RunLogger` — no new abstractions.

## Milestone

A single file — `docs/calibration.md`: "LLM-judge vs expert (QWK): content 0.71,
coherence 0.63, range 0.58, accuracy 0.66; diverges on ...", plus a reproducible
`npm run eval`. In a portfolio this reads as engineering with a measured result,
not "we generated some text".
