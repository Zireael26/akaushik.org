# SEO + AIO Status — akaushik.org

> Live status doc. **Plan lives in [`2026-05-18-seo-strategy-design.md`](./2026-05-18-seo-strategy-design.md).** Scheduled tasks append to this file; humans hand-edit. Order of sections is load-bearing — automation reads + writes by anchor.

**Last updated:** 2026-07-04T18:36:00+05:30
**Active phase:** Phase 0/1 — canonical hygiene mostly resolved; owner SEO tasks remain

---

## 1. Phase progress

### Phase 0 — Canonical hygiene
- [x] 2.1 Vercel: set `akaushik.org` as primary; mark `akaushik.dev` as 308-redirect-to-primary **(Abhishek)** — verified 2026-07-04: `https://akaushik.dev/` and `https://akaushik.dev/work/neev` both return 308 to `https://akaushik.org/...`. (`developerabhishek.live` row dropped 2026-05-19 — registration lapsed, ADR-0003 Outcome.)
- [~] 2.2 Verify 308 chain on `akaushik.dev` via `seo-redirect-health` for 7 consecutive days — 2026-07-04 manual check is green; automated 7-day streak not yet recorded here.
- [x] 2.3 Add `alternates.canonical` to per-page Next metadata (helper + per-page wiring) — landed in spec PR
- [ ] 2.4 Verify `akaushik.org` (+ `akaushik.dev` once redirect lands) in GSC + Bing Webmaster Tools **(Abhishek)**
- [x] ~~2.5 Submit GSC Change of Address: `developerabhishek.live` → `akaushik.org`~~ — **dropped 2026-05-19**, ADR-0003 Outcome (legacy host no longer owned). Recovery falls back to Wikidata `sameAs` + sitemap submission.
- [ ] 2.6 Submit `sitemap.xml` for `akaushik.org` to GSC + Bing **(Abhishek)**
- [x] 2.7 `app/sitemap.ts` emits canonical-host URLs only (verified)

### Phase 1 — Topic SEO foundation
- [ ] 3.1 Buyer-intent keyword discovery → `docs/seo/keywords.json` (≥50 queries)
- [x] 3.2 Editorial calendar seeded → `docs/seo/editorial-calendar.md` (50 slots) — seeded 2026-05-19
- [ ] 3.2 Pillar page: `/writing/ai-for-indian-msme-guide`
- [ ] 3.2 Pillar page: `/writing/agent-systems-production-guide`
- [ ] 3.2 Pillar page: `/writing/rag-in-practice-guide`
- [ ] 3.3 Flagship 2026-Q3: Neev architecture deep-dive
- [ ] 3.3 Flagship 2026-Q4: Fastembed → TEI extended
- [ ] Cluster posts: 0/30+ published

### Phase 2 — Identity SEO
- [x] 4.1 `Person` JSON-LD on root + `/about` (landed in spec PR)
- [x] 4.2 `Article` JSON-LD on every `/writing/*` and `/work/*` (landed in spec PR)
- [ ] 4.3 `BreadcrumbList` schema site-wide (deferred — superseding `lib/structured-data.ts` ships Person/Org/WebSite/Article only; add `breadcrumbGraph` follow-up)
- [ ] 4.4 Wikidata entry created + survived first deletion review **(Abhishek)**
- [ ] 4.5 Profile NAP sync across all 6 platforms **(Abhishek)**
- [ ] 4.6 GitHub profile: pin top 6 repos + README cross-link akaushik.org **(Abhishek)**
- [ ] 4.7 OG image per page extended to `/work/[slug]` + `/writing/[slug]`

### Phase 3 — AIO on-site
- [x] llms.txt + llms-full.txt (already shipped per `agent-readiness-contract`)
- [x] .well-known/agent-skills + mcp.json (shipped)
- [x] .md alternates (shipped)
- [ ] OSS repo: `msme-agent-starter` (target 2026-Q3)
- [ ] OSS repo: `tei-bge-reranker-migration` (target 2026-Q4)

---

## 2. Canonical NAP (drift-monitor reads this block)

```yaml
name: Abhishek Kaushik
tagline: AI systems for businesses that haven't met AI yet
photo_url: https://akaushik.org/images/about/abhishek.webp
canonical_url: https://akaushik.org
sameAs:
  - https://github.com/Zireael26
  - https://linkedin.com/in/abhishek26k
  - https://x.com/abhi2601k
  # Bluesky, Hashnode, dev.to, Wikidata pending owner action — see §9 handoff queue H5 + H6.
```

---

## 3. Metrics

Refreshed monthly by `seo-monthly-health` scheduled task.

| Metric | 2026-05 | 2026-06 | 2026-07 | Target (12mo) |
|--------|---------|---------|---------|----------------|
| Pages indexed (akaushik.org, GSC) | — | — | — | ≥ sitemap count |
| Top-10 ranking queries (problem-shaped) | — | — | — | ≥15 |
| Top-10 ranking queries (identity-qualified) | — | — | — | ≥3 |
| Wikidata entry status | not-created | — | — | live + cited |
| Schema validation errors (validator.schema.org) | — | — | — | 0 |
| Broken internal links | — | — | — | 0 |
| Lighthouse mobile (home, p95) | — | — | — | ≥90 |
| `llms-full.txt` byte size | — | — | — | grows with content |
| Inbound organic leads attributed (manual log) | 0 | — | — | ≥5/month |

---

## 4. Alerts

`seo-redirect-health` appends ONLY on failure. Empty section = healthy.

_(none)_

---

## 5. Drift log

`seo-monthly-profile-drift` appends ONLY on drift. Empty section = NAP consistent.

_(none)_

---

## 6. Editorial calendar

→ [`editorial-calendar.md`](./editorial-calendar.md)

_Seeded 2026-05-19 with 50 slots across the five pillars (msme, agents, rag, eng, craft). `seo-weekly-draft` re-reads on every run; flips status to `drafted` / `published` / `dropped` as PRs move._

---

## 7. Automation health

| Task ID | Cadence | Last run | Status | Notes |
|---------|---------|----------|--------|-------|
| `seo-redirect-health` | Daily 07:00 | — | not-yet-fired | seeded |
| `seo-weekly-draft` | Mon 06:00 | — | not-yet-fired | seeded; awaits editorial-calendar.md |
| `seo-monthly-health` | 1st 07:00 | — | not-yet-fired | seeded |
| `seo-monthly-profile-drift` | 1st 08:00 | — | not-yet-fired | seeded; awaits NAP fill-in |
| `seo-quarterly-flagship` | Quarterly 06:00 | — | not-yet-fired | seeded |

---

## 8. Leads attributed

Manual log. Append `[YYYY-MM-DD] <source query or page> → <outcome>` per inbound lead traced to organic search.

_(none)_

---

## 9. Human handoff queue

Outstanding manual-only tasks. Roll items into Phase progress checkboxes (§1) when complete.

| # | Task | Where | Status |
|---|------|-------|--------|
| H1 | Vercel: set `akaushik.org` primary + `akaushik.dev` 308 redirect to primary | Vercel dashboard | done 2026-07-04 — manual curl verified `/` + `/work/neev` 308 |
| H2 | GSC + Bing Webmaster: verify `akaushik.org` (Domain property via DNS TXT preferred) | GSC console | pending |
| H3 | ~~GSC: submit Change of Address~~ | — | dropped 2026-05-19 (legacy host lapsed) |
| H4 | GSC + Bing: submit sitemap.xml | GSC | pending |
| H5 | Wikidata: create entry "Abhishek Kaushik (AI engineer)" with references | wikidata.org | pending |
| H6 | Profile NAP sync (LinkedIn, GitHub, X, Bluesky, dev.to, Hashnode) | each platform | pending |
| H7 | GitHub profile: pin 6 repos + README cross-link | github.com | pending |
| H8 | Fill canonical-NAP block (§2) with real handles + Wikidata Q-id once H5 done | this file | pending |
| H9 | Editorial review of weekly draft PRs | GitHub | recurring |
| H10 | Register the 5 Cowork scheduled tasks (each prompts an approval dialog) — see `docs/seo/scheduled-tasks/REGISTER.md` | Cowork session | pending |
| H11 | Cloudflare robots controls on `akaushik.org` zone audited and `https://akaushik.org/robots.txt` purged. | Cloudflare dashboard | done 2026-07-04 — live `robots.txt` has no managed block and serves `Content-Signal: search=yes, ai-input=yes, ai-train=yes` |
| H12 | GSC: after H11 lands, **Settings → robots.txt report → Request a recrawl**. Add `akaushik.org` as a Domain property (DNS TXT) if currently a URL-prefix property. | GSC dashboard | pending — unblocked by H11 |
