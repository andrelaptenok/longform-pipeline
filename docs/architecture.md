# Architecture

## Decisions

**Single provider interface.** Every model sits behind one `Provider`.
Comparing Claude / GPT / Gemini / local models requires no pipeline changes.

**Prompts as versioned files.** `prompts/<name>.<version>.md`. The eval system
compares versions against each other; changing a prompt is a commit, not an
in-place string edit.

**JSONL logging.** Every call: model, tokens, cost, latency, prompt version,
run id. The basis for cost reports and regression tracking.

**train / test split.** The test set is never used during development, only for
the final measurement — otherwise the prompt overfits to the examples.

## Open questions

- vector DB choice for RAG (Qdrant / Chroma)
- corpus chunking strategy
- LLM-judge calibration: agreement with human scoring on reference materials
