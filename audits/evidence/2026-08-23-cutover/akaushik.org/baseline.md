# AEO gate: akaushik.org

- Domain: `https://akaushik.org`
- Commit: `009f1710314511c99d64c6c1662cb3a5cda3b961`
- Mapping: **PASS** — configured deployment identity and deterministic content marker were observed (2 local, 10 live)
- Overall status: **PASS**

## Stage status

| Stage | Status | Reason |
|---|---|---|
| crawler-probes | PASS | all crawler probes returned complete HTML responses |
| geo-optimizer | PASS | pinned scanner geo-optimizer-skill==4.16 completed |
| mapping | PASS | configured deployment identity and deterministic content marker were observed (2 local, 10 live) |
| model-triage | PASS | no-llm-pass: deterministic dispositions retained |
| normalization | PASS | deterministic normalization completed |

## Finding delta

- New: 1
- Unchanged: 0
- Resolved: 0

## Graded findings

### `d2e1ab4dc416fd0d228b81ad` ai_discovery

- Detector/rule: `geo-optimizer` / `ai_discovery`
- State/severity: `failed` / `info`
- Evidence: **SPECULATIVE**
- SEO impact: `unknown`
- AEO impact: `unknown`
- Disposition: `no-llm-pass`
- Raw evidence: `raw/geo-optimizer.stdout`
- Rationale: Raw scanner observation retained for triage; it is not a work order.
