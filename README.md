# longform-pipeline

[![CI](https://github.com/andrelaptenok/longform-pipeline/actions/workflows/ci.yml/badge.svg)](https://github.com/andrelaptenok/longform-pipeline/actions/workflows/ci.yml)

Pipeline for generating long, structured texts with an eval system.

**Domain:** learning materials for the matura exam (English language). Quality
criteria are anchored to the official CKE scoring rubric rather than subjective
preference, which allows calibrating the LLM-as-judge against an external
reference.

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
