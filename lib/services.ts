// Source of truth for the Services section and the llms-full.txt corpus.
// Services.tsx and app/llms-full.txt/route.ts render this file verbatim.

export type ServiceRow = {
  label: 'Entry' | 'First moves' | 'You hold' | 'Fit';
  value: string;
};

export type Service = {
  num: string;
  title: string;
  lede: string;
  list: ReadonlyArray<ServiceRow>;
};

export const SERVICES_HEADING = 'Same discipline, three doors in.';

export const SERVICES_INTRO =
  'The method above is not a display piece. It is how work happens here, and it is how work with you would happen. Pick the door that matches the situation. The first step through any of them is a clarify pass and a spec you are free to reject.';

export const SERVICES: ReadonlyArray<Service> = [
  {
    num: 'S/01',
    title: 'Greenfield',
    lede: 'An agent system or product surface that does not exist yet. Changelog entries and ADRs start with the first commit, not after the demo.',
    list: [
      { label: 'Entry', value: 'You know the problem. Nobody has built the thing.' },
      {
        label: 'First moves',
        value: 'A clarify interview, then a spec triad. Nothing load-bearing skips them.',
      },
      {
        label: 'You hold',
        value: 'The spec triad, the ADRs, a dated changelog, and a receipt for every done claim.',
      },
      {
        label: 'Fit',
        value: 'Teams with a real workflow and real data who want the process as part of the product.',
      },
    ],
  },
  {
    num: 'S/02',
    title: 'Hardening',
    lede: 'Something already runs and it is not trustworthy yet. Observability, an eval harness, error budgets, a runbook, and the process gate wired before new features land.',
    list: [
      { label: 'Entry', value: 'It works in demos. You need it to work at 3pm on a Tuesday.' },
      {
        label: 'First moves',
        value: 'Read the system as it actually is. Measure before changing a line.',
      },
      {
        label: 'You hold',
        value: 'Measured baselines, a wired gate, a runbook, and tests that fail when the intent breaks.',
      },
      { label: 'Fit', value: "Whoever lost a night's sleep to their own prototype." },
    ],
  },
  {
    num: 'S/03',
    title: 'Adoption',
    lede: 'Install the regime itself: hooks, gates, the spec pipeline, loop ceilings, and an autonomy level chosen for your risk posture. Strict variants exist as shipped presets, not theory.',
    list: [
      { label: 'Entry', value: 'Your team ships with agents, but nobody trusts the output.' },
      {
        label: 'First moves',
        value: 'Audit what enforcement you already have. Adopt the smallest tier that bites.',
      },
      {
        label: 'You hold',
        value: 'Enforced hooks, a spec pipeline your repos share, and decision logs you can read later.',
      },
      {
        label: 'Fit',
        value: 'Operators who want discipline that survives contact with a deadline.',
      },
    ],
  },
];

export const SERVICES_AUTONOMY = {
  title: 'Autonomy is yours to set.',
  body: 'You choose how much gets decided without you, from explain-everything to decide-and-log. Secrets, destructive operations, and receipts stay enforced at every level.',
} as const;

export const SERVICES_PROOF = {
  lead: 'Every claim on this page is checkable.',
  rest: 'Start at the ADRs and the changelog, or take the whole site as one Markdown file.',
  adrHref: 'https://github.com/Zireael26/akaushik.org/tree/main/docs/adr',
  changelogHref: 'https://github.com/Zireael26/akaushik.org/blob/main/docs/CHANGELOG.md',
  corpusHref: '/llms-full.txt',
} as const;
