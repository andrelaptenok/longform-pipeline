# Architecture

## Decisions

**Single provider interface.** Every model sits behind one `Provider`.
Comparing Claude / GPT / Gemini / local models requires no pipeline changes.

**Prompts as versioned files.** `prompts/<name>.<version>.md`. The eval system
compares versions against each other; changing a prompt is a commit, not an
in-place string edit.

**JSONL logging.** Every call: model, tokens, cost, latency, prompt version,
stop reason, run id. One log per surface — `generate.jsonl` and `judge.jsonl` —
because the cost of producing a material and the cost of scoring it are two
separate budgets, and the project reports both.

**Raw HTTP rather than a vendor SDK.** The provider layer speaks HTTP directly.
A vendor SDK would bring retries, timeouts and streaming for free, but it would
also make the "provider-agnostic core" claim rest on someone else's client. The
cost of the choice is that this repository owns those three things: they live in
`src/providers/http.ts` and are tested there. Revisit the moment a second
provider needs materially different transport behaviour.

**Streaming is the only transport.** Every call sets `stream: true` and the
provider joins the deltas before returning. A non-streaming request for a long
output runs into HTTP timeouts, and long output is what this project exists to
produce, so there is no second path to keep working. `GenerateResult.stopReason`
carries the model's own account of why it stopped — `max_tokens` there means the
text is truncated, which the run summary counts.

**Deadlines and retries in the transport.** A request carries a deadline (10
minutes by default, covering the stream) and retries throttling, timeouts and
server errors with exponential backoff, honouring `retry-after`. Requests the
server rejected outright are not retried. Without this a single 429 mid-corpus
would end an eval run and waste everything it had already paid for.

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
