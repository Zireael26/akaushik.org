import { Fragment } from 'react';
import { AgentGraphClient } from '@/components/scene/AgentGraphClient';
import { StaticSVGScene } from '@/components/scene/StaticSVGScene';
import statsData from '@/public/data/stats.json';

const MARQUEE_ITEMS = [
  'Next.js 16',
  'TypeScript 6',
  'Hugging Face TEI',
  'Qdrant',
  'MCP',
  'React 19',
  'Three.js',
  'Tailwind 4',
  'Vercel',
  'Kubernetes',
  'Ory',
];

function MarqueeTrack() {
  return (
    <>
      {[0, 1].map((loopIndex) =>
        MARQUEE_ITEMS.map((item, i) => (
          <Fragment key={`${loopIndex}-${i}`}>
            <span>{item}</span>
            <em>·</em>
          </Fragment>
        )),
      )}
    </>
  );
}

export default function Hero() {
  const total = statsData.totalContributions.toLocaleString('en-US');

  return (
    <section
      className="hero"
      data-screen-label="01 Hero"
      data-companion-pose="hero"
    >
      <div className="hero-grid">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="eyebrow-num">01</span> — AI engineer · six years shipping software
          </p>
          <h1 className="hero-title" data-slot="tagline">
            <span data-tagline-a>
              AI systems for<br />businesses that<br />haven&apos;t met AI yet.
            </span>
            <span data-tagline-b hidden>
              I build agent systems<br />that go to production —<br />and stay there.
            </span>
            <span data-tagline-c hidden>
              I build the systems<br />your business<br />will actually use.
            </span>
          </h1>
          <p className="hero-lede">
            I design and build the agents and back-end systems that quietly do the work — for
            distributors, founders, and teams who&apos;d rather see results than slide decks.
          </p>
          <div className="hero-cta-row">
            <a className="btn btn-primary" href="#contact">
              Let&apos;s talk about your project<span className="arrow" aria-hidden="true">→</span>
            </a>
            <a className="btn btn-ghost" href="#work">
              Read a case study
            </a>
          </div>
          <dl className="hero-facts" aria-label="At a glance">
            <div>
              <dt>Currently</dt>
              <dd>Bluehost · agents framework</dd>
            </div>
            <div>
              <dt>Building</dt>
              <dd>Neev · VeriCite · curat.money</dd>
            </div>
            <div>
              <dt>Shipped</dt>
              <dd>
                <span data-stat="total">{total}</span> commits · last 12mo
              </dd>
            </div>
            <div>
              <dt>Based in</dt>
              <dd>India · working globally</dd>
            </div>
          </dl>
        </div>

        <figure className="hero-scene" aria-label="Decorative graph of agent nodes exchanging messages">
          <div className="scene-frame">
            <div className="scene-label">
              <span className="scene-label-key">scene.live</span>
              <span className="scene-label-val">agent-graph · three.js</span>
            </div>
            {/* SVG paints first (SSR-rendered, reduced-motion-safe). The Three.js
                canvas loads on top and visually covers it once mounted. */}
            <StaticSVGScene />
            <AgentGraphClient />
            <div className="scene-foot">
              <span>four agents · cursor-reactive · reduced-motion safe</span>
              <span className="scene-foot-mono">scene/agent-graph.v2</span>
            </div>
          </div>
        </figure>
      </div>

      <div className="hero-marquee" aria-hidden="true">
        <div className="marquee-track">
          <MarqueeTrack />
        </div>
      </div>
    </section>
  );
}
