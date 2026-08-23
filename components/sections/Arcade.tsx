import { ArcadeGame } from '@/components/pixel/ArcadeGame';
import { SectionHead } from '@/components/pixel/SectionHead';

export function Arcade() {
  return (
    <section
      className="px-section px-split px-arcade"
      id="arcade"
      data-screen-label="08 Arcade"
      aria-labelledby="arcade-head"
    >
      <SectionHead
        id="arcade-head"
        variant="column"
        heading="A field that only resolves when you move through it."
        label="Arcade"
        headingTarget
        headingMax={18}
      />

      <div className="px-split-body">
        <p id="arcade-objective" className="px-split-intro">
          Clear every reading before three deterministic signals close the route. The board,
          motion and optional sound are generated live in the page&apos;s own pixel language — no
          sprites, recordings or hidden game assets.
        </p>
        <ArcadeGame />
      </div>
    </section>
  );
}
