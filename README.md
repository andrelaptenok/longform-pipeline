# longform-pipeline

[![CI](https://github.com/andrelaptenok/longform-pipeline/actions/workflows/ci.yml/badge.svg)](https://github.com/andrelaptenok/longform-pipeline/actions/workflows/ci.yml)

`longform-pipeline` generates long, structured texts with an LLM and scores
their quality with an eval system built around an external reference.

**Domain:** learning materials for the Polish _matura_ exam (English language).

**The core idea is calibration against an external standard.** LLM output
quality is usually judged by taste. Here it is scored against the official CKE
rubric (the Polish exam board's) rather than subjective preference, so the
LLM-as-judge can be calibrated against an objective reference — that
calibration is the point of the project.

The pipeline is deliberately eval-driven, not a thin API wrapper: prompts are
versioned artifacts, every generation call is logged (tokens, cost, latency,
prompt version), and quality is measured with deterministic checks before
falling back to the LLM-judge. The aim is a reproducible, measurable
generation loop — not a one-shot demo.

## Stack

- TypeScript, Anthropic Agent SDK
- Multi-provider abstraction (Claude / GPT / Gemini / local via Ollama)
- RAG over a corpus of reference materials
- Eval system: deterministic checks + LLM-as-judge + regressions

## Structure

```
prompts/          prompts as versioned files
evals/
  rubric.yaml     quality criteria
  dataset/        train (development) + test (untouched until the final run)
  runners/        check execution
  reports/        results (git-ignored)
src/
  pipeline/       generation steps: plan -> sections -> assemble -> revise
  providers/      unified interface over models
  logging/        JSONL log per call: tokens, cost, latency
docs/             architecture, decisions, limitations
```

## Getting started

```bash
npm install
cp .env.example .env   # fill in the keys
npm run gen
npm run eval
```

## Status

In development.
