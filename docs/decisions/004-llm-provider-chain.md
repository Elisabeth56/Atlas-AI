# 004. Free LLM provider chain behind one module, no framework

Status: accepted · 2026-10-26

## Context
Groq's free tier for `llama-3.3-70b-versatile` allows about 12,000 tokens per minute and 1,000 requests per day. A run uses an estimated 20–30k tokens across 4 calls, so one run can hit the per-minute limit on its own. A 429 used to fail the run. Retries were blind: they never sent the model the validation error.

## Decision
- Implement `app/ai/llm.py` with `generate(prompt_id, inputs, schema)`.
- Providers are tried in order on 429, 5xx or timeout: Groq, then Cerebras, then Gemini Flash-Lite. All three use OpenAI-compatible chat endpoints, so one httpx client covers them.
- On a short `retry-after` (under 10 s), wait and retry. Otherwise move to the next provider.
- On invalid JSON, retry once, sending the Pydantic error back to the model. Then fail the step, which can be retried.
- Prompts live in `app/ai/prompts/*.md` and are versioned in git.
- DataHub text is delimited and marked as data, not instructions.
- Each call logs a row in `llm_calls`: provider, model, prompt version, tokens in and out, latency and outcome.

## Alternatives rejected
- **Groq only.** One rate limit is a single point of failure.
- **Cerebras as primary.** It has a larger daily budget. Revisit once evals compare quality.
- **LangChain or LlamaIndex.** A fixed 4-call pipeline with structured output takes about 100 lines of httpx. A framework adds abstraction depth and version churn without saving work.

## Consequences
- Output can vary by provider. Evals (`evals/`) must run on each provider so a fallback doesn't quietly lower quality.
- Gemini's free limits aren't published, and developers report about 500 requests a day on Flash-Lite, so it's a last resort only.

## At 10x
Every free tier's daily limits run out. Fix: a paid tier on the primary provider, trimmed prompts (send only the relevant columns), and caching repeated planner calls.

## Revisit when
Fallback calls exceed 20% of all calls, or evals show a provider scores lower on grounding.

## As built (#29)
- `ProviderChain` reports every HTTP call through an `on_call` callback: provider, model, prompt, tokens, latency, outcome, and whether an earlier provider already failed the call. The chain itself never touches the database.
- The orchestrator stores each call in `llm_calls`, tagged with the run and agent from a context variable set around `agent.run`.
- Failed calls and answers that came from a fallback provider are appended to the step's live log, e.g. `groq rate limited` → `answered by cerebras (gpt-oss-120b)`.
- `GET /api/runs/{id}` returns per-step `usage` (calls, tokens in/out, latency, failed calls). The eval harness (#42) reads the same table.
