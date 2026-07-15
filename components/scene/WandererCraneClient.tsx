'use client';

import { lazy, Suspense, useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';

const DESKTOP_QUERY = '(min-width: 861px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// React.lazy invokes this import only when the gated component renders. Unlike
// next/dynamic, it does not publish preload metadata for a scene that narrow or
// motion-constrained visitors must never download.
const WandererCrane = lazy(() => import('@/components/scene/WandererCrane'));

function getSnapshot(): boolean {
  if (!window.matchMedia(DESKTOP_QUERY).matches) return false;
  if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return false;
  return document.documentElement.getAttribute('data-motion') !== 'off';
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(onPolicyChange: () => void): () => void {
  const desktop = window.matchMedia(DESKTOP_QUERY);
  const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
  desktop.addEventListener('change', onPolicyChange);
  reducedMotion.addEventListener('change', onPolicyChange);

  const motionAttribute = new MutationObserver(onPolicyChange);
  motionAttribute.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-motion'],
  });

  return () => {
    desktop.removeEventListener('change', onPolicyChange);
    reducedMotion.removeEventListener('change', onPolicyChange);
    motionAttribute.disconnect();
  };
}

export function WandererCraneClient() {
  const pathname = usePathname();
  const runtimeAllowed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const allowed = pathname === '/' && runtimeAllowed;

  // The server-rendered SVG is a complete renderer, not merely a loading
  // spinner. Mark it as the active fallback immediately after the policy gate
  // opens so slow scene chunks and unavailable WebGL remain a settled state.
  // WandererCrane promotes this attribute to `canvas` once its first frame is
  // ready and owns cleanup of that promoted state.
  useEffect(() => {
    if (!allowed) return;
    const host = document.getElementById('companion');
    if (!host || host.hasAttribute('data-wanderer-renderer')) return;

    host.setAttribute('data-wanderer-renderer', 'fallback');
    return () => {
      if (host.getAttribute('data-wanderer-renderer') === 'fallback') {
        host.removeAttribute('data-wanderer-renderer');
      }
    };
  }, [allowed]);

  if (!allowed) return null;

  return (
    <Suspense fallback={null}>
      <WandererCrane />
    </Suspense>
  );
}
