# Limitations and roadmap

## Current limitations

- only one pipeline step is implemented (plan)
- the corpus is empty — `evals/dataset/train/` and `test/` carry no labeled
  materials yet, so `npm run eval` has nothing to measure, and the gate over the
  corpus passes vacuously
- the corpus will be self-authored, with its quality spread built by controlled
  degradation, so variants of one base material are near-duplicates and
  agreement measured across them reads optimistically; see
  `docs/labeling-protocol.md`
- a single labeler assigns every score; until a second one joins, self-agreement
  is the only check on drift
- the LLM-judge runs and its agreement with a human can be computed, but nothing
  has been measured: with no corpus there is no calibration, no prompt
  iteration, and no threshold that says whether the judge is ready
- the CKE gate is asked of the judge in `prompts/judge.v2.md` and checked on
  human scores by the corpus gate, but nothing enforces it on judge output: a
  verdict that scores `content` 0 and `range` 4 is accepted and calibrated as
  it stands. Aggregating judge scores into a total will have to apply the gate
  in code, or the total will read higher than CKE's would
- `evals/rubric.yaml` matches the CKE informator for poziom rozszerzony, checked
  against it on 2026-07-26. The scale is 0-5 per dimension, while CKE's own
  maxima differ by criterion (5 / 2 / 3 / 3); the point split lives in the
  weights instead, so a dimension can be scored 5 where CKE would cap it at 2
- RAG is not wired in
- a single provider (Anthropic); its pricing is hardcoded next to the model id
  in `getProvider` and has to be updated by hand when either changes
- a failed stream is not resumed — a mid-stream network error costs the tokens
  already generated

## Roadmap

1. Write the base materials, derive the graded variants, and label everything
   against the protocol
2. Calibrate the judge on train: iterate `judge.vN`, set the threshold, then
   measure once on test and write `docs/calibration.md`
3. Build out the steps: sections, assemble, revise
4. RAG over the corpus
5. OpenAI / Gemini / Ollama providers, comparative run
6. CI: run evals on prompt changes

## Done

- deterministic checks (length, sections, banned constructions) behind a
  registry the rubric drives, unit-tested and gating in CI
- the dataset unit: one markdown file per item, frontmatter carrying the brief,
  the check params and the human scores
- `evals/rubric.yaml` populated with the four CKE dimensions, their point
  weights and score anchors
- the scaffold for collection: an item template, a labeling protocol, and a
  test that gates every committed item on parsing, a full set of human scores,
  and the deterministic layer
- the 0-5 scale of the CKE scheme, so that a response which fails the task can
  be recorded as CKE would record it, with the gate between criteria executable
  on both 0 and 1
- `expected_failures`: a degraded material declares the deterministic checks it
  is meant to break, and the gate requires exactly those — which is what lets
  the corpus hold a material that is too short or in the wrong format without
  the deterministic layer reading as broken
- the LLM-judge, the agreement metrics (QWK, MAE, exact, within 1, Spearman)
  and the calibration that pairs judge scores with expert ones per dimension
