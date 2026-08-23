import Hero from '@/components/sections/Hero';
import { About } from '@/components/sections/About';
import { Process } from '@/components/sections/Process';
import { Experience } from '@/components/sections/Experience';
import { Work } from '@/components/sections/Work';
import { Services } from '@/components/sections/Services';
import Writing from '@/components/sections/Writing';
import OpenSource from '@/components/sections/OpenSource';

/**
 * Home — the single-page scroll, in the pixel design.
 *
 * There is no Contact section any more. In this design contact lives in the
 * footer (components/site/SiteFooter.tsx), next to the marquee and the notched
 * button, the way gaurijha.com does it; a standalone contact block would repeat it.
 */
export default function Home() {
  return (
    <main id="top">
      <Hero />
      <About />
      <Process />
      <Experience />
      <Work />
      <Services />
      <Writing />
      <OpenSource />
    </main>
  );
}
