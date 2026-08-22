import { Marquee } from '@/components/pixel/Marquee';
import { Skyline } from '@/components/pixel/Skyline';

/**
 * Site footer — the contact surface, and the last pixel band on every page.
 *
 * Ported from gaurijha.com's Footer.astro (tag `public-site-v1`), home variant:
 * marquee canvas, notched CTA, centred note, email line, legal row, skyline.
 * The single `page` variant there existed because Astro renders a footer per
 * page; this footer is mounted once in app/layout.tsx, so it carries the home
 * shape everywhere.
 *
 * Gauri's legal row carries a Bar Council ethics line. That is a regulatory
 * requirement for an advocate and has no equivalent here, so it is dropped
 * rather than replaced.
 */
const EMAIL = 'hello@akaushik.org';
const GITHUB = 'https://github.com/Zireael26';
const LINKEDIN = 'https://www.linkedin.com/in/abhishek26k';
// Handle confirmed by the operator, and it matches the twitter:creator already
// declared in app/layout.tsx's metadata.
const X_PROFILE = 'https://x.com/abhi2601k';

export default function SiteFooter() {
  const year = new Date().getFullYear();
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  const shortSha = sha ? sha.slice(0, 7) : null;

  return (
    <footer id="contact" className="px-footer">
      <Marquee />

      <div className="px-contact">
        <a className="px-cta px-notch" href={`mailto:${EMAIL}`} data-btnfx="1">
          Get in touch
        </a>
        <p className="px-contact-note">
          Email is best. Tell me what you&rsquo;re trying to do in plain language: the industry, who
          uses it, what&rsquo;s getting in the way. I read every one.
        </p>
        <div className="px-contact-mail">
          <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
          <span> &middot; New Delhi</span>
        </div>
        <div className="px-legal">
          <span>&copy; {year} Abhishek Kaushik</span>
          <a href={GITHUB} target="_blank" rel="noreferrer">
            GitHub &#8599;
          </a>
          <a href={X_PROFILE} target="_blank" rel="noreferrer">
            X&nbsp;↗
          </a>
          <a href={LINKEDIN} target="_blank" rel="noreferrer">
            LinkedIn &#8599;
          </a>
          <a href="/llms.txt">/llms.txt</a>
          {shortSha ? <span className="px-legal-sha">build {shortSha}</span> : null}
        </div>
      </div>

      <Skyline />
    </footer>
  );
}
