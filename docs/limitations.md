# Limitations and roadmap

## Current limitations

- only one pipeline step is implemented (plan)
- the corpus is empty — `evals/dataset/train/` and `test/` carry no labeled
  materials yet, so `npm run eval` has nothing to measure
- quality is judged by deterministic checks only; the LLM-judge and its
  calibration against human scores do not exist yet
- `evals/rubric.yaml` follows the CKE scheme for poziom rozszerzony, but the
  point split and the word range still have to be verified against the current
  informator
- RAG is not wired in
- a single provider (Anthropic)

## Roadmap

1. Collect a reference corpus (20-30), split into train / test, with a written
   labeling protocol and a decision on the provenance of the materials
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
