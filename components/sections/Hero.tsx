import { Heatfield } from '@/components/pixel/Heatfield';

/**
 * Hero — wordmark, justified subtitle, right-aligned note, then the heatfield.
 *
 * Structure and measurements follow gaurijha.com's hero: display 800 reserved
 * for the wordmark and nothing else, the subtitle justified on both edges via
 * text-align-last, the note right-aligned against a conic-gradient swatch.
 *
 * Copy is a first pass against docs/voice.md and is expected to change — the
 * tagline variants that used to live behind data-tagline-a/b/c are collapsed to
 * one line here, because the pixel design has no room for a runtime A/B switch
 * and the TweakBridge that drove it is gone.
 */
export default function Hero() {
  return (
    <section className="px-hero-block" data-screen-label="01 Hero">
      <div className="px-hero">
        <h1 className="px-hero-title">
          Abhishek,
          <br />
          Kaushik.
        </h1>
        <div className="px-hero-aside">
          <div className="px-hero-sub" data-cursor-target="1">
            An engineer for businesses that haven&rsquo;t met AI yet
          </div>
          <div className="px-hero-note">
            <span className="px-hero-swatch" aria-hidden="true" />
            <p>
              Agent systems, retrieval, and operational AI. Six years shipping software &middot;
              New Delhi.
            </p>
          </div>
        </div>
      </div>

      <Heatfield />
    </section>
  );
}
