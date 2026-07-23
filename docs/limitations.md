# Limitations and roadmap

## Current limitations

- only one pipeline step is implemented (plan)
- the eval system is a scaffold with no checks implemented yet
- RAG is not wired in
- a single provider (Anthropic)

## Roadmap

1. Populate rubric.yaml from the official CKE rubric
2. Collect a reference corpus (20-30), split into train / test
3. Build out the steps: sections, assemble, revise
4. Deterministic checks
5. LLM-as-judge + calibration
6. RAG over the corpus
7. OpenAI / Gemini / Ollama providers, comparative run
8. CI: run evals on prompt changes
