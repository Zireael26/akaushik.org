import { MethodBand } from '@/components/pixel/MethodBand';
import { SectionHead } from '@/components/pixel/SectionHead';

/**
 * The method — statement head, flow band, four steps, then the artifact list.
 *
 * Ported from gaurijha.com's `gj-method`. Two contracts come across verbatim
 * and must not be renamed:
 *   - `data-mstep="0".."3"` on the four column wrappers. The band engine reads
 *     the document for these to drive its hover highlight.
 *   - `data-icon` on the four mount canvases. The icon art is authored
 *     separately; nothing here draws.
 *
 * The steps are his, not the prototype's: gaurijha's Read / Research / Write /
 * Argue is a litigator's sequence. The artifact list below the grid is the old
 * "Built in the open" section carried forward — those links are real and load
 * bearing, so they stay in the section rather than being dropped in the port.
 */

type Step = {
  step: string;
  icon: string;
  tone: 'cobalt' | 'amber' | 'red' | 'ink';
  body: string;
};

const METHOD: ReadonlyArray<Step> = [
  {
    step: '01 · Read',
    icon: 'read',
    tone: 'cobalt',
    body: 'The system as it actually is, and the constraints around it, before a line changes.',
  },
  {
    step: '02 · Spec',
    icon: 'spec',
    tone: 'amber',
    body: 'A PRD for the shape, an ADR for every decision that would be expensive to unwind.',
  },
  {
    step: '03 · Build',
    icon: 'build',
    tone: 'red',
    body: 'In phases, against a roadmap. Every shipped change lands in the changelog.',
  },
  {
    step: '04 · Harden',
    icon: 'harden',
    tone: 'ink',
    body: 'The process gate runs before the PR opens. Done means a receipt, not a summary.',
  },
];

type Artifact = {
  code: string;
  description: string;
  href: string;
};

const REPO = 'https://github.com/Zireael26/akaushik.org/blob/main';

const ARTIFACTS: ReadonlyArray<Artifact> = [
  {
    code: 'PRD.md',
    description: 'Product requirements, v0.1 to live',
    href: `${REPO}/docs/PRD.md`,
  },
  {
    code: 'ADR-0001-stack.md',
    description: 'Stack decision · Next.js 16 · pinned',
    href: `${REPO}/docs/adr/0001-nextjs-over-sveltekit.md`,
  },
  { code: 'ROADMAP.md', description: 'Phased delivery plan', href: `${REPO}/docs/ROADMAP.md` },
  {
    code: 'AGENT_READINESS.md',
    description: 'Cloudflare isitagentready checks',
    href: `${REPO}/docs/AGENT_READINESS.md`,
  },
  { code: 'CHANGELOG.md', description: 'Every shipped change', href: `${REPO}/docs/CHANGELOG.md` },
  { code: '/llms-full.txt', description: 'Whole site, one Markdown file', href: '/llms-full.txt' },
];

export function Process() {
  return (
    <section id="method" className="px-section px-method" data-screen-label="03 Method">
      <SectionHead heading="The method." label="In order, every time" />

      <MethodBand />

      <div className="px-method-grid">
        {METHOD.map((step, i) => (
          <div key={step.icon} data-mstep={String(i)}>
            <div className="px-icon-slot">
              <canvas data-icon={step.icon} aria-hidden="true" />
            </div>
            <div className={`px-step is-${step.tone}`}>{step.step}</div>
            <p className="px-step-body">{step.body}</p>
          </div>
        ))}
      </div>

      <div className="px-method-open">
        <div className="px-method-open-head">
          <div className="px-head-label" data-cursor-target="1">
            Built in the open
          </div>
          <p className="px-method-open-note">
            This site runs the process it describes. The artifacts are public.
          </p>
        </div>
        <ul className="px-method-open-list">
          {ARTIFACTS.map((a) => (
            <li key={a.code}>
              <a
                href={a.href}
                target={a.href.startsWith('http') ? '_blank' : undefined}
                rel={a.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              >
                <code>{a.code}</code>
                <span>{a.description}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
