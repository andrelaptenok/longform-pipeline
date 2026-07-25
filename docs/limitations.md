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
- quality is judged by deterministic checks only; the LLM-judge and its
  calibration against human scores do not exist yet
- `evals/rubric.yaml` matches the CKE informator for poziom rozszerzony, checked
  against it on 2026-07-26. What the rubric does not model is CKE's dependency
  between criteria: a `zgodność z poleceniem` of 0 forces every other criterion
  to 0, and a 1 caps them at 1. Aggregating judge scores into a total will have
  to account for that, or the total will read higher than CKE's would
- RAG is not wired in
- a single provider (Anthropic); its pricing is hardcoded next to the model id
  in `getProvider` and has to be updated by hand when either changes
- a failed stream is not resumed — a mid-stream network error costs the tokens
  already generated

## Roadmap

1. Write the base materials, derive the graded variants, and label everything
   against the protocol
2. LLM-as-judge, calibrated against the human scores (QWK per dimension)
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
