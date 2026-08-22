import { RuledRow } from '@/components/pixel/RuledRow';
import { SectionHead } from '@/components/pixel/SectionHead';

/**
 * Experience — the split-editorial shape: statement head and mono label in the
 * left column, justified intro and ruled rows on the right.
 *
 * Every fact below is sourced from this repo: `lib/about-copy.ts` (the meta
 * rows and the six-years line), the `year` / `role` / `tag` frontmatter of
 * `content/case-studies/*.mdx`, and `lib/structured-data.ts`. Nothing is
 * inferred. The prototype this ports from carries a five-row dated CV
 * including schooling and pre-current employers; this repo does not contain
 * that record, so those rows are absent rather than invented — see the TODO
 * below the rows.
 */
export function Experience() {
  return (
    <section
      id="experience"
      className="px-section px-split px-experience"
      data-screen-label="04 Experience"
    >
      <SectionHead
        variant="column"
        heading="Six years shipping software, most recently on agent systems."
        label="Work experience"
        headingTarget
        headingMax={18}
      />

      <div className="px-split-body">
        <p className="px-split-intro">
          Six years of shipping software, the recent stretch of it AI and platform engineering. My
          day work is the agents framework backend behind Bluehost&rsquo;s AI products. Around it
          sit Neev, VeriCite and curat.money, plus advisory work on ClusterBid. The through-line is
          agent-native software: modular monoliths, retrieval systems, and operational AI.
        </p>

        <RuledRow tag="’25 —">
          <strong>Bluehost &middot; agents framework.</strong> Platform engineer. A hand in
          maintaining and continuously improving the foundational platform behind Bluehost&rsquo;s
          agentic AI products. The specifics are under confidentiality.
        </RuledRow>

        <RuledRow tag="’26 —">
          <strong>Neev.</strong> Co-founder and CTO across product, architecture and build. A
          modular operations platform for Indian MSMEs, starting with textile distribution.
        </RuledRow>

        <RuledRow tag="’26 —">
          <strong>VeriCite.</strong> Co-founder and CTO, retrieval pipeline. A multi-tenant
          institutional RAG platform on HF TEI, Qdrant, Ory and Kubernetes.
        </RuledRow>

        <RuledRow tag="’26 —">
          <strong>curat.money.</strong> CTO and tech lead. A fair-comparison tool for crypto cards,
          built from the data pipeline up.
        </RuledRow>

        <RuledRow tag="’26" last>
          <strong>ClusterBid.</strong> Engineering advisor on process and platform. A Go and Next.js
          inference-cloud platform taken from monorepo checks to a real-host k3s UAT.
        </RuledRow>

        {/* TODO: needs CV detail from Abhishek — employers, titles and date ranges for the
            roughly four years before Bluehost (2025); Bluehost start month; founding dates for
            Neev, VeriCite and curat.money (the case-study frontmatter only says "2026 — now",
            which is when the case study was written, not when the work began); degree,
            institution and years for education; city and country; any internships or earlier
            roles. Until those are in the repo, this section stays five rows. */}
      </div>
    </section>
  );
}
