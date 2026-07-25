# longform-pipeline

Working guide for this repository. Product overview lives in `README.md`,
design notes in `docs/`.

Pipeline for generating long, structured texts with an eval system. Domain:
learning materials for the matura exam (English). Quality is scored against the
official CKE rubric rather than subjective preference, so the LLM-as-judge can
be calibrated against an external reference — that calibration is the point of
the project.

## Layout

```
prompts/          prompts as versioned files (plan.v1.md, ...)
evals/
  rubric.yaml     quality criteria (CKE dimensions, weights, score anchors)
  rubric.ts       rubric schema + validating loader
  dataset/
    TEMPLATE.md   copyable item, documents the frontmatter
    train/        development set
    test/         held out for the final run — do not touch
  dataset.ts      dataset item (frontmatter + gold reference)
  specs.ts        rubric defaults + item overrides -> checks to run
  yaml.ts         shared YAML parsing and validation helpers
  checks/         deterministic checks + registry (length, sections, banned)
  runners/        check execution (run.ts)
  reports/        run output (git-ignored)
src/
  cli.ts          entry point for `npm run gen`
  pipeline/       generation steps: plan -> sections -> assemble -> revise
  providers/      unified interface over models (types, index, anthropic)
  logging/        JSONL log per call: tokens, cost, latency
docs/             architecture, decisions, limitations, labeling protocol
```

Tests are not in the tree because they are never apart from it: a module is
covered by `<module>.test.ts` next to it.

## Commands

```bash
npm install
cp .env.example .env   # ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY
npm run gen            # generate (tsx src/cli.ts)
npm run eval           # run evals (tsx evals/runners/run.ts)
npm test               # unit tests (vitest run)
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run format         # prettier --write .
```

`typecheck`, `lint`, `format:check`, and `test` must pass before a change is
considered done — CI (`.github/workflows/ci.yml`) enforces the same four on
every PR.

## Architecture principles

- **Provider-agnostic core.** Models sit behind the `Provider` interface
  (`src/providers/types.ts`); the pipeline never touches a concrete SDK. A new
  backend means implementing `Provider` and registering it in `getProvider`
  (`src/providers/index.ts`) — nothing else changes. That is what keeps model
  comparison at eval time cheap.

- **Cost and latency are first-class.** Every `GenerateResult` carries `usage`,
  `costUsd`, `latencyMs`, and `model`; cost derives from token usage and a
  per-provider `Pricing`. Update `Pricing` when a model or its rates change —
  stale rates silently corrupt every cost report.

- **Every call is logged.** `RunLogger` (`src/logging/logger.ts`) appends one
  JSONL `CallRecord` per call — `runId`, `step`, `promptVersion`, `model`,
  tokens, cost, latency. This is the audit trail for regressions and
  per-prompt-version comparison.

- **Prompts are versioned artifacts.** They live as files in `prompts/`, loaded
  by name + version (`loadPrompt('plan', 'v1')`) and stamped into every
  `CallRecord`, so any output traces back to the prompt that produced it. Revise
  by adding a version, never by editing one in place.

- **Explicit linear pipeline.** `plan -> sections -> assemble -> revise`
  (`src/pipeline/run.ts`); each step loads a versioned prompt, calls the
  provider, and records the call. Only `plan` exists today — new steps replicate
  the pattern.

- **Quality measured against an external reference.** Output is judged against
  the CKE rubric (`evals/rubric.yaml`), not taste, which keeps the LLM-judge
  calibrated. Prefer deterministic checks (length, CEFR markers, required
  constructions) before the LLM-judge.

- **The test set is held out.** Develop and tune only on `evals/dataset/train/`;
  `evals/dataset/test/` is touched only for the final measurement.

## Conventions

**Language.** Everything committed is in English — code, identifiers, error
messages, docs, commit and PR text. The repository is public and read as
international OSS. Exceptions: `prompts/` and `evals/dataset/` use the domain
language (English here); `evals/rubric.yaml` may carry Polish CKE terms. Chat
with the owner is in Russian, but none of it reaches the files.

**No comments in code.** No inline comments, no docstrings, no TODOs. Names,
types, and structure carry the intent; if something still needs explaining, it
belongs in `docs/` or in the commit message.

**Layout.** A test sits next to the module it covers
(`checks/length.ts` → `checks/length.test.ts`), never in a separate tree. A
directory appears when interchangeable units need a registry to pick between
them (`evals/checks/`); a single responsibility stays a single file at the top
of its area (`evals/yaml.ts`). A module that reads a directory of data sits
beside it, sharing its name (`evals/dataset.ts` and `evals/dataset/`).

**Commits.** Conventional Commits, imperative mood
(`feat: add deterministic length check`). Never commit or push without an
explicit request.

**Branches.** Never commit to `main` — it is the PR target. Work on a branch
(`feat/...`, `fix/...`, `docs/...`) and merge through a PR.

**Authorship.** This is a portfolio — the commit history must read as the
owner's alone. The `Co-Authored-By` and "Generated with Claude Code" trailers
are suppressed via `attribution` in `.claude/settings.json`; leave them off. No
footers, Claude Code links, or emoji markers in commits or PRs — the message is
only a description of the change.
