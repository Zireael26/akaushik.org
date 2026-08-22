import Hero from '@/components/sections/Hero';

/**
 * Home.
 *
 * Mid-conversion. The eight-section scroll is being rebuilt in the pixel design
 * one section at a time; only the ones already converted are mounted here. The
 * remaining components still exist under components/sections/ and come back in
 * this order as they land:
 *
 *   About → Work → Writing → Services → Process → OpenSource → Contact
 *
 * Mounting an unconverted section would render it against a stylesheet that no
 * longer carries its rules, which reads as a bug rather than as work in
 * progress. Hence the deliberate omission.
 */
export default function Home() {
  return (
    <main id="top">
      <Hero />
    </main>
  );
}
