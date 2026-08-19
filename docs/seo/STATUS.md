# SEO + AIO Status — akaushik.org

> Live status doc. **Plan lives in [`2026-05-18-seo-strategy-design.md`](./2026-05-18-seo-strategy-design.md).** Registered tasks may update this file from their repository source templates; source-template presence alone does not prove registration. Humans hand-edit. Order of sections is load-bearing — automation reads + writes by anchor.

**Last updated:** 2026-07-15T11:49:22+05:30
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
- [~] 4.3 `BreadcrumbList` schema on published `/work/[slug]` and `/writing/[slug]` detail pages — repository implementation and focused tests are green; production schema proof remains open
- [ ] 4.4 Wikidata entry created + survived first deletion review **(Abhishek)**
- [ ] 4.5 Profile NAP sync across all 6 platforms **(Abhishek)**
- [ ] 4.6 GitHub profile: pin top 6 repos + README cross-link akaushik.org **(Abhishek)**
- [x] 4.7 OG image per page extended to `/work/[slug]` + `/writing/[slug]`

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

Intended to be refreshed monthly by `seo-monthly-health` when that task is registered and enabled.

| Metric                                          | 2026-05     | 2026-06 | 2026-07 | Target (12mo)      |
| ----------------------------------------------- | ----------- | ------- | ------- | ------------------ |
| Pages indexed (akaushik.org, GSC)               | —           | —       | —       | ≥ sitemap count    |
| Top-10 ranking queries (problem-shaped)         | —           | —       | —       | ≥15                |
| Top-10 ranking queries (identity-qualified)     | —           | —       | —       | ≥3                 |
| Wikidata entry status                           | not-created | —       | —       | live + cited       |
| Schema validation errors (validator.schema.org) | —           | —       | —       | 0                  |
| Broken internal links                           | —           | —       | —       | 0                  |
| Lighthouse mobile (home, p95)                   | —           | —       | —       | ≥90                |
| `llms-full.txt` byte size                       | —           | —       | —       | grows with content |
| Inbound organic leads attributed (manual log)   | 0           | —       | —       | ≥5/month           |

---

## 4. Alerts

The `seo-redirect-health` source contract appends only on failure when the task is registered and enabled. Empty means no failure has been recorded here; it does not prove the task ran.

_(none)_

---

## 5. Drift log

The `seo-monthly-profile-drift` source contract appends only on drift when the task is registered and enabled. Empty means no drift has been recorded here; it does not prove the task ran.

_(none)_

---

## 6. Editorial calendar

→ [`editorial-calendar.md`](./editorial-calendar.md)

_Seeded 2026-05-19 with 50 slots across the five pillars (msme, agents, rag, eng, craft). The registered `seo-weekly-draft` bootstrap, when present and enabled, re-reads its repository source on every run and records the real draft PR URL in a second pushed commit._

---

## 7. Automation health

Five repository source templates live under [`scheduled-tasks/`](./scheduled-tasks/); [`REGISTER.md`](./scheduled-tasks/REGISTER.md) contains one-time registration bootstraps that re-read those sources each run. Editing a source template changes behavior without updating a separate registered prompt. Scheduler controls are needed only for registration, cadence, and enabled/paused state.

**Registration audit (2026-07-15):** `$HOME/.claude/scheduled-tasks/` is absent, and H10 remains pending. This repo therefore does not evidence an active Cowork registration. Treat the rows below as intended schedules and source status until the scheduler itself confirms otherwise.

| Task ID                     | Cadence         | Last run | Status        | Notes                                                    |
| --------------------------- | --------------- | -------- | ------------- | -------------------------------------------------------- |
| `seo-redirect-health`       | Daily 07:00     | —        | not-confirmed | repository source template only                          |
| `seo-weekly-draft`          | Mon 06:00       | —        | not-confirmed | repository source template; editorial calendar is seeded |
| `seo-monthly-health`        | 1st 07:00       | —        | not-confirmed | repository source template only                          |
| `seo-monthly-profile-drift` | 1st 08:00       | —        | not-confirmed | repository source template; awaits NAP fill-in           |
| `seo-quarterly-flagship`    | Quarterly 06:00 | —        | not-confirmed | repository source template only                          |

---

## 8. Leads attributed

Manual log. Append `[YYYY-MM-DD] <source query or page> → <outcome>` per inbound lead traced to organic search.

_(none)_

---

## 9. Human handoff queue

Outstanding manual-only tasks. Roll items into Phase progress checkboxes (§1) when complete.

| #   | Task                                                                                                                                                              | Where                | Status                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| H1  | Vercel: set `akaushik.org` primary + `akaushik.dev` 308 redirect to primary                                                                                       | Vercel dashboard     | done 2026-07-04 — manual curl verified `/` + `/work/neev` 308                                                                |
| H2  | GSC + Bing Webmaster: verify `akaushik.org` (Domain property via DNS TXT preferred)                                                                               | GSC console          | pending                                                                                                                      |
| H3  | ~~GSC: submit Change of Address~~                                                                                                                                 | —                    | dropped 2026-05-19 (legacy host lapsed)                                                                                      |
| H4  | GSC + Bing: submit sitemap.xml                                                                                                                                    | GSC                  | pending                                                                                                                      |
| H5  | Wikidata: create entry "Abhishek Kaushik (AI engineer)" with references                                                                                           | wikidata.org         | pending                                                                                                                      |
| H6  | Profile NAP sync (LinkedIn, GitHub, X, Bluesky, dev.to, Hashnode)                                                                                                 | each platform        | pending                                                                                                                      |
| H7  | GitHub profile: pin 6 repos + README cross-link                                                                                                                   | github.com           | pending                                                                                                                      |
| H8  | Fill canonical-NAP block (§2) with real handles + Wikidata Q-id once H5 done                                                                                      | this file            | pending                                                                                                                      |
| H9  | Editorial review of weekly draft PRs                                                                                                                              | GitHub               | recurring                                                                                                                    |
| H10 | Register or verify the 5 Cowork tasks from `docs/seo/scheduled-tasks/REGISTER.md`; mark done only after the scheduler lists all five as enabled                   | Cowork session       | pending — no local scheduled-tasks directory found 2026-07-15                                                                |
| H11 | Cloudflare robots controls on `akaushik.org` zone audited and `https://akaushik.org/robots.txt` purged.                                                           | Cloudflare dashboard | done 2026-07-04 — live `robots.txt` has no managed block and serves `Content-Signal: search=yes, ai-input=yes, ai-train=yes` |
| H12 | GSC: after H11 lands, **Settings → robots.txt report → Request a recrawl**. Add `akaushik.org` as a Domain property (DNS TXT) if currently a URL-prefix property. | GSC dashboard        | pending — unblocked by H11                                                                                                   |
| H13 | Render ADR-0011 writing loops locally when a weekly draft uses the default loop policy; commit composition source plus MP4/WebP and register the slug in `WRITING_LOOPS`.               | Local FFmpeg + Chrome | recurring external owner action; explicit process/non-visual exceptions need no render                                       |
