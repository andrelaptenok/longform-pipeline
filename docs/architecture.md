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

**One markdown file per dataset item.** Frontmatter carries the brief, the
per-check params and the human scores; the body is the gold reference. One unit
feeds the deterministic checks, the judge and the calibration, so the three
stages never drift apart.

**The rubric mirrors the CKE scheme.** Dimensions, their Polish names and their
weights come from the official point split (treść 5 / spójność 2 / zakres 3 /
poprawność 3), and each dimension carries anchors for 1, 3 and 5. Weights are
the CKE point maxima rather than normalized shares, so every number traces back
to the source.

## Open questions

- vector DB choice for RAG (Qdrant / Chroma)
- corpus chunking strategy
- LLM-judge calibration: agreement with human scoring on reference materials
