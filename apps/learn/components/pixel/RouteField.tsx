'use client';

import { PixelField } from './PixelField';
import { neuralTraining } from '@/lib/pixel/neural';

export function RouteField({ isHero = true }: { isHero?: boolean }) {
  return (
    <div className={`px-route-field ${isHero ? 'is-hero' : ''}`}>
      <PixelField
        sources={[neuralTraining]}
        preset={isHero ? 'hero' : 'band'}
        cellSize={isHero ? 5 : 4}
        interactive
        cycleOnClick={false}
        animate={2}
        seed={42}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  );
}
