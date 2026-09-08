# ADR-0011: Writing-post HyperFrames loops

Status: Superseded by ADR-0020 (2026-08-24)
Date: 2026-05-19

Writing posts no longer ship HyperFrames loops. The same three failures that
retired the case-study reels apply here: baked pixels, no dark variant, and a
motion gate with no remaining caller. The art is a `RouteField` canvas.


## Context

ADR-0008 codified the HyperFrames pipeline for **case-study** reels — eight compositions (`scripts/hyperframes/<slug>/`), rendered to `public/video/work/<slug>.{mp4,webp}` (card + hero variants), consumed by `components/work/reels.tsx`. It did not cover the **writing-post** loops that landed during the 2026-05-11 restore of regressed assets.

Today the writing surface ships four loops in `public/video/writing/`:

```
public/video/writing/
  ai-for-msme.{mp4,webp}
  building-this-portfolio.{mp4,webp}
  fastembed-to-tei.{mp4,webp}
  micrograd-makemore.{mp4,webp}
```

Consumed by `components/media/hyperframes-loop.tsx` (SVG floor per slug) + `components/media/MotionVideo.tsx` (motion-gated `<video>`). The component layer is documented; the assets were until now governed only by a CHANGELOG fix entry.

Two writing posts have no loop:

- `trellis` (2026-05-11)
- `best-practices-into-trellis` (2026-05-18)

This ADR documents the policy and closes gap-analysis finding D4.

## Decision

1. **Default:** every new writing post lands with a HyperFrames loop. The loop is decorative (the floor SVG carries the topic motif; the loop is ambient) so a post without one degrades visually but the page still works.

2. **Exception:** posts whose topic is non-visual or whose subject is a process artefact (the engineering process itself, internal tooling) may ship without a loop. The two current loop-less posts (`trellis`, `best-practices-into-trellis`) fall under this exception — both are about engineering process, not a product or a system the reader can picture.

3. **Composition source.** New loops add a directory under `scripts/hyperframes/<slug>/` with the same shape as the case-study compositions (HTML + GSAP timeline; `render-all.mjs` renders MP4 + webp via the HyperFrames CLI). The render step requires FFmpeg + headless Chrome locally and does **not** run in the agent sandbox — the render pass is an explicit owner task or runs on a local dev box.

4. **Aspect + duration.** Writing loops are 16:9, 5 seconds, loop-friendly. MP4 transferSize stays under 600 KiB; webp poster under 30 KiB. If a future post needs a different aspect, document the exception in CHANGELOG.

5. **Retention.** Loops are committed as binary artefacts under `public/video/writing/`. Do not delete on disk even when a post is unpublished — they make the git history reversible.

6. **Naming.** Filename matches the MDX slug exactly. The `WRITING_LOOPS` switch in `components/media/hyperframes-loop.tsx` is the single registry; an asset on disk without an entry there is dead weight.

## Alternatives considered

- **Drop the writing loops entirely.** Tempting on bundle-budget grounds (the videos add to media transferSize). Rejected: the loops are part of the visual identity per `docs/DESIGN_DIRECTION.md`, and `MotionVideo` gates them off for reduced-motion users so the cost is opt-in.
- **Single loop for all writing posts.** Cheaper to maintain but loses the per-topic visual cue that ties the loop to the floor SVG.

## Consequences

- New writing posts have a clear policy. The `seo-weekly-draft` cron prompt should mention this ADR so generated drafts flag "loop pending" in the draft PR body.
- The render pass remains owner-only. Adding `trellis` or `best-practices-into-trellis` loops is tracked as an owner handoff queue item, not a CI step.
- The two loop-less posts are documented exceptions, not oversights. Future audits should not flag them.

## References

- `docs/CHANGELOG.md` 2026-05-11 "Restore four regressions" entry.
- `components/media/hyperframes-loop.tsx`.
- `components/media/MotionVideo.tsx`.
- ADR-0008 (case-study HyperFrames pipeline).
- `docs/HANDOFF_HYPERFRAMES.md` (case-study render handoff; not generalised to writing).
