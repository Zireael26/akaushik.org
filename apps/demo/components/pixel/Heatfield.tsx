'use client';

import { PixelField } from './PixelField';
import { neuralTraining } from '@/lib/pixel/neural';
import { prompt, trellis, wordmark } from '@/lib/pixel/sources';

const EXHIBITS = [neuralTraining, prompt, trellis, wordmark('AK.')];

export function Heatfield() {
  return (
    <div className="px-heatfield">
      <PixelField
        sources={EXHIBITS}
        preset="hero"
        cellSize={5}
        interactive
        cycleOnClick
        animate={2}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  );
}
