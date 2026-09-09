'use client';

import { PixelField } from '@/components/pixel/PixelField';
import { agentGraph, trellis } from '@/lib/pixel/sources';

export type OverviewHeroProps = {
  titleLine1?: string;
  titleLine2?: string;
  subtitle?: string;
  welcomeNote?: string;
};

export function OverviewHero({
  titleLine1 = 'Project,',
  titleLine2 = 'Workspace.',
  subtitle = 'Shared records · Working notes · Active focus',
  welcomeNote = 'A place for our work together. Meetings, notes, and questions, kept in one place.',
}: OverviewHeroProps) {
  return (
    <section className="px-hero-block" data-screen-label="02 Workspace Overview">
      <div className="px-hero">
        <h1 className="px-hero-title">
          {titleLine1}
          <br />
          {titleLine2}
        </h1>
        <div className="px-hero-aside">
          <div className="px-hero-sub">{subtitle}</div>
          <div className="px-hero-note">
            <span className="px-hero-swatch" aria-hidden="true" />
            <p>{welcomeNote}</p>
          </div>
        </div>
      </div>

      <div className="px-project-field">
        <PixelField
          sources={[agentGraph, trellis]}
          preset="band"
          cellSize={4.5}
          interactive
          cycleOnClick
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </div>
    </section>
  );
}
