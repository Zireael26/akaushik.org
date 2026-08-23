# Clarify 005 — Arcade field

**Spec:** `spec.md` · **Branch:** `feat/arcade` · **Autonomy:** build the approved substitute; do not deploy

This clarification records the operator's binding handoff. It does not reopen the
request into a third-party arcade adaptation. The feature is original work in
this site's own pixel language.

---

## 1. Intent

Build a playable maze-chase section for the home page: clear every reading in an
original field while three abstract vectors pursue the player with different
strategies. The section is both a small game and evidence that the site's visual
system can carry interactive work without a framework or downloaded assets.

The feature must feel native to akaushik.org. It uses the existing square-cell
rule, deterministic hash, palette helpers, theme observer, section rhythm and
motion switch. A cabinet, CRT treatment, imported retro sprite language or
isolated black slab would make it a foreign object and is rejected.

## 2. IP boundary

The feature must not reproduce or evoke a protected third-party arcade work.
That excludes its title, character silhouettes, pursuer characters, maze,
recorded or reconstructed audio, sprite proportions, UI chrome and recognizable
melodies or timing patterns.

All shipped visual geometry is authored in this repository. All production
audio is synthesized at runtime from WebAudio oscillators and gain envelopes.
No sound file, sprite sheet, download, embedded binary payload or base64 asset
ships with the site. Generated review captures live outside the worktree under
`/tmp/akaushik-arcade-receipts-20260823/`; they are evidence, not site assets.

## 3. Chosen direction — the closing register

Three directions were compared:

1. **Closing register, recommended.** An asymmetric survey field with a
   cell-by-cell perimeter register that closes as readings are cleared. It keeps
   the chase legible, gives progress a site-specific visual grammar and works in
   both themes without a cabinet.
2. **Ambient weather field.** Push the shared field noise and scatter further
   into the board. It belongs to the site, but too much hash culling makes walls
   ambiguous and adds motion that competes with play.
3. **Turn ledger.** Make every input a discrete turn and present the game as an
   editorial rule sheet. It is strongest for reduced motion but loses the live
   chase texture the request calls for.

The implementation takes direction 1. In normal motion mode it is a live chase.
When either motion preference says stop, the same state machine becomes
discrete: one legal direction input advances the player one cell and exactly one
pursuer in Direct → Cutline → Drift order, then redraws once. No continuous
animation runs. A blocked direction advances nothing.

The player is an open directional bracket in themed ink, not a face or mascot.
The pursuers are named by behaviour and distinguished by geometry and by a
non-character colour assignment:

- **Direct** is a cobalt needle routing toward the player's current cell.
- **Cutline** is a lime chevron targeting three legal cells ahead of the
  player's heading.
- **Drift** is an amber knot choosing deterministic non-reversing branches. At a
  dead end it reverses rather than stopping.

## 4. Inputs and game state

- Start is explicit; there is no attract mode or autoplay.
- Keyboard: arrow keys and WASD while the canvas has focus.
- Touch: four visible direction controls and swipe gestures on the canvas.
- The canvas does not trap focus. Tab leaves it normally.
- Score, remaining readings, three lives and phase are visible in DOM text.
- Clearing the final reading ends the step and wins before a pursuer can move.
  Otherwise a collision costs one life and resets positions without restoring
  cleared readings. In live mode the respawn lasts 900ms and ignores input. In
  discrete mode the collision announcement and reset happen in the same redraw,
  with no timer. The third collision loses the run.
- Win and loss both expose a restart control.

The board is a fixed, hand-authored asymmetric layout. Determinism comes from
`h(x, y)` for stable visual texture and Drift tie-breaking, never from
`Math.random()`.

## 5. Audio

Sound is visibly off by default. The preference is stored at
`abhishek.portfolio.arcade.sound`. A stored opt-in restores the control state,
but an `AudioContext` is not created or resumed until a fresh Start, Restart,
Sound, direction-key, direction-button or swipe gesture inside the game
satisfies browser autoplay policy.

The original sonic vocabulary is a dry field instrument:

- a short triangle tick for a cleared reading;
- a brief square/triangle pressure drop for a collision;
- separated, non-melodic oscillator pulses when the register closes;
- one low, short drop on loss.

There is no movement loop, siren, attract sound, sampled noise, recorded asset or
recognizable jingle. The rendered audio receipt must be captured from this
synthesizer, not inferred from source code.

## 6. Accessibility and motion

The canvas has an accessible name and fallback text. Adjacent DOM instructions
explain the objective, controls, symbols and three pursuer behaviours. State
changes use a concise polite live region; score changes do not flood it.

The site-wide `html[data-motion="off"]` switch and
`prefers-reduced-motion: reduce` are equal vetoes. Either cancels the animation
loop and removes interpolation, pulses, trails and automatic movement. Theme and
state changes still redraw a static frame, and direct input advances the
discrete reduced-motion game.

Touch controls meet the site's 44px coarse-pointer rule. Shape and labels repeat
colour distinctions. The standing axe-core target remains zero WCAG A/AA
violations.

## 7. Success and rollback

Success requires observable play at 1440px and 375px in both themes, captured in
screenshots and a short GIF; synthesized audio captured as a rendered artifact;
and the full command receipts named in `spec.md`.

Rollback is one branch. The section, engine, synthesizer, styles and tests are
additive and can be reverted without changing content routes, the global pixel
engine or the theme mechanism. The foreman owns local unit commits and receipts.
The apex owns visual acceptance and any push, deploy or merge.

## Open questions

None. The binding handoff resolves scope, IP, input, audio, motion, accessibility,
performance and receipt requirements. Visual and sonic taste are accepted only
against rendered artifacts during implementation.
