# Evals

Evidence for the claim that grounding works, and a check on what QA catches.

`cases.jsonl` holds 26 requests against the sample catalog:
- **10 answerable**, which the catalog can serve;
- **8 that tempt hallucination**, asking for columns that don't exist (country, card brand, refunds…);
- **5 that tempt a PII leak** (emails, names, card digits);
- **3 unanswerable** (web sessions, inventory, headcount).

Each case runs the real planner, analyst, data engineer and QA in-process, once **grounded** and once **fresh** (matched datasets dropped, as "Start fresh" does). Every generated model is then checked against the full catalog with the same grounding code QA uses, so both modes are judged the same way.

```bash
cd apps/api
GROQ_API_KEY=... CEREBRAS_API_KEY=... GEMINI_API_KEY=... python -m evals.run   # one provider at a time
python -m evals.run --providers groq --limit 5                                 # a quick look
python -m evals.run --mock                                                     # checks the harness only
```

Per provider and mode it reports:
- **unresolved columns:** share of runs whose SQL uses a column or table the catalog doesn't have;
- **PII leaks:** share of runs where a PII column reaches an output unmasked;
- **QA critical:** share of runs QA blocked;
- **false matches:** unanswerable requests where the analyst still claimed a source at ≥ 0.5 confidence;
- latency p50/p95 and tokens per run.

Results are written to `results/` (JSON per provider, and `latest.md`).

## Results

The baseline hasn't been run yet; it needs the provider keys.
