import { ProcessPipeline, type ProcessStep } from '@/components/pixel/ProcessPipeline';
import { SectionHead } from '@/components/pixel/SectionHead';

/**
 * The method — statement head, flow band, four steps, then the artifact list.
 *
 * The band and the four tiles are one component, ProcessPipeline, because they
 * draw from the same glyph library — hovering a step swells that stage in the
 * band. gaurijha's version was an abstract four-colour flow band plus separate
 * icon art, which said "there are four of these" and nothing more.
 *
 * The steps are his, not the prototype's: gaurijha's Read / Research / Write /
 * Argue is a litigator's sequence. The artifact list below is the old "Built in
 * the open" section carried forward — those links are real and load bearing, so
 * they stay in the section rather than being dropped in the port.
 */

const METHOD: ReadonlyArray<ProcessStep> = [
  {
    label: '01 · Read',
    kind: 'read',
    tone: 'cobalt',
    body: 'The system as it actually is, and the constraints around it, before a line changes.',
  },
  {
    label: '02 · Spec',
    kind: 'spec',
    tone: 'amber',
    body: 'A PRD for the shape, an ADR for every decision that would be expensive to unwind.',
  },
  {
    label: '03 · Build',
    kind: 'build',
    tone: 'red',
    body: 'In phases, against a roadmap. Every shipped change lands in the changelog.',
  },
  {
    label: '04 · Harden',
    kind: 'harden',
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

      <ProcessPipeline steps={METHOD} />

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
