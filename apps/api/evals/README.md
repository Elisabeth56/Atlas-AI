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
GROQ_API_KEY=... GEMINI_API_KEY=... python -m evals.run   # one provider at a time
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

On GitHub: Actions → **evals** → Run workflow. It needs `GROQ_API_KEY` and `GEMINI_API_KEY` as repository secrets. The table appears in the run summary, and the JSON is attached as an artifact.

Run 20261029-1031 UTC, 26 cases:

| provider | mode | cases | failed | unresolved columns | PII leaks | QA critical | false matches | p50 s | p95 s | tokens/run |
|---|---|---|---|---|---|---|---|---|---|---|
| groq | grounded | 26 | 17 | 0.0% | 77.8% | 77.8% | n/a | 9.29 | 24.52 | 4756 |
| groq | fresh | 26 | 12 | 14.3% | 7.1% | 7.1% | n/a | 4.93 | 25.37 | 3410 |
| gemini | grounded | 26 | 2 | 16.7% | 79.2% | 79.2% | 0.0% | 9.53 | 16.55 | 3145 |
| gemini | fresh | 26 | 0 | 96.2% | 26.9% | 26.9% | 0.0% | 9.33 | 19.72 | 2843 |

Failed cases by reason: Groq, 21 rate limited and 8 HTTP 400 (JSON mode rejections, now repaired instead of failed); Gemini, 1 HTTP 503 and 1 other.

Rates are over completed cases, so the Groq rows rest on 9 and 14 runs and shouldn't be read as results. Rerun Groq alone with a pause of about 40 s: `--providers groq --pause 40`, or the workflow's `pause` input.
