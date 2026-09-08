import { ShipItGame } from '@/components/pixel/ShipItGame';
import { SectionHead } from '@/components/pixel/SectionHead';

export function ShipIt() {
  return (
    <section
      className="px-section px-split px-shipit"
      id="shipit"
      data-screen-label="08 Ship It"
      aria-labelledby="shipit-head"
    >
      <SectionHead
        id="shipit-head"
        variant="column"
        heading="Ship it — literally. Eat the code before the bugs eat you."
        label="Ship It"
        headingTarget
        headingMax={18}
      />

      <div className="px-split-body">
        <p id="shipit-objective" className="px-split-intro">
          A maze-chase where you are a blinking cursor eating code characters and four bugs hunt
          you with four different strategies: one follows, one ambushes ahead, one flanks off its
          leader, one chases only from a distance. Push a commit to frighten them. The board,
          motion and optional sound are generated live in the page&apos;s own pixel language — no
          sprites, recordings or hidden game assets.
        </p>
        <ShipItGame />
      </div>
    </section>
  );
}
