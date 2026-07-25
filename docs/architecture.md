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

**The judge is told the rubric, not taught it.** The prompt file
(`prompts/judge.v1.md`) holds the instructions and the output contract; the
dimensions, scales and anchors are rendered into the system prompt from
`rubric.yaml` at call time. Editing an anchor therefore changes what the judge
is asked without touching the prompt version, and both versions are stamped on
every verdict.

**The judge's reply is validated, not trusted.** It must be JSON carrying every
rubric dimension, an integer inside that dimension's scale, and a non-empty
justification. A reply that fails is quoted back with the reason and one more
attempt is made; after that the item fails loudly rather than entering the
corpus with an invented score.

**No sampling parameters anywhere.** `temperature` and friends are rejected by
the current frontier models, so setting them would tie the pipeline to older
ones. Determinism is not available at this layer; the calibration report is the
place where that shows up honestly.

**Judging is opt-in.** `npm run eval` runs the deterministic layer and touches
no API. `npm run eval -- --judge` adds the judge, and only then is a provider
constructed and a key required — a corpus-wide judge run costs money and should
never happen by accident.

**The rubric mirrors the CKE scheme.** Dimensions, their Polish names and their
weights come from the official point split (treść 5 / spójność 2 / zakres 3 /
poprawność 3), and each dimension carries anchors for 1, 3 and 5. Weights are
the CKE point maxima rather than normalized shares, so every number traces back
to the source.

## Open questions

- vector DB choice for RAG (Qdrant / Chroma)
- corpus chunking strategy
- LLM-judge calibration: agreement with human scoring on reference materials
