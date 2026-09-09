'use client';

import { useState } from 'react';

export type FacetItem = {
  key: string;
  label: string;
  content: React.ReactNode;
};

export type SourceTabsProps = {
  facets: FacetItem[];
};

export function SourceTabs({ facets }: SourceTabsProps) {
  const [activeKey, setActiveKey] = useState<string>(facets[0]?.key ?? '');

  if (facets.length === 0) return null;

  // Single facet: render content directly without redundant tab buttons
  if (facets.length === 1) {
    return <div>{facets[0]!.content}</div>;
  }

  const activeIndex = facets.findIndex((f) => f.key === activeKey);
  const currentKey = activeIndex === -1 ? (facets[0]?.key ?? '') : activeKey;

  return (
    <div>
      <div className="px-source-tabs" role="tablist" aria-label="Available record facets">
        {facets.map((facet, index) => {
          const isSelected = facet.key === currentKey;
          return (
            <button
              key={facet.key}
              type="button"
              role="tab"
              className={`px-source-tab ${isSelected ? 'is-active' : ''}`}
              aria-selected={isSelected}
              aria-controls={`pane-${facet.key}`}
              id={`tab-btn-${facet.key}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setActiveKey(facet.key)}
              onKeyDown={(e) => {
                let nextIndex = -1;
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  nextIndex = (index + 1) % facets.length;
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  nextIndex = (index - 1 + facets.length) % facets.length;
                } else if (e.key === 'Home') {
                  nextIndex = 0;
                } else if (e.key === 'End') {
                  nextIndex = facets.length - 1;
                }

                if (nextIndex !== -1) {
                  e.preventDefault();
                  const targetFacet = facets[nextIndex]!;
                  setActiveKey(targetFacet.key);
                  const btn = document.getElementById(`tab-btn-${targetFacet.key}`);
                  btn?.focus();
                }
              }}
            >
              {facet.label}
            </button>
          );
        })}
      </div>

      {facets.map((facet) => (
        <div
          key={facet.key}
          id={`pane-${facet.key}`}
          role="tabpanel"
          tabIndex={0}
          aria-labelledby={`tab-btn-${facet.key}`}
          hidden={facet.key !== currentKey}
        >
          {facet.content}
        </div>
      ))}
    </div>
  );
}
