/**
 * The hero: a small network training, on repeat.
 *
 * Four phases per epoch, and the whole point is that the backward pass is
 * visibly a *different* thing from the forward one rather than the same sweep
 * mirrored — it travels the other way, it lights the edges rather than the
 * nodes, and it leaves the weights changed behind it.
 *
 *   forward   activation sweeps left to right; nodes swell as the front reaches
 *             them, edges ahead of it stay thin
 *   loss      the output layer holds, and the error marks appear beside it
 *   backward  the gradient sweeps right to left along the edges, and each edge
 *             it passes takes its new width
 *   settle    everything relaxes into the updated weights before the next epoch
 *
 * Weights are deterministic: they come from the shared hash keyed by epoch, so
 * the network "learns" the same way on every load and across every viewer. The
 * magnitudes converge as the epoch count rises and then wrap, which is what
 * makes it read as training rather than as noise being reshuffled.
 *
 * This source animates off `t`, so it must be mounted with the field's
 * `animate` option or it will render one frozen frame.
 */
import { h } from '../pixel';
import type { FieldSource } from './field';

/** Nodes per layer, input to output. */
const LAYERS = [4, 5, 5, 3] as const;

/** Epochs per full colour cycle before the weights wrap and start over. */
const EPOCHS = 6;

/** One epoch every ~8s at the field's 0.006/frame clock. */
const RATE = 0.35;

/** Below this magnitude an edge is dropped, unless it is a node's strongest. */
const EDGE_THRESHOLD = 0.46;

type Node = { x: number; y: number };

/** Smooth 0..1 ramp, used to fade a front in and out as it passes. */
function bump(distance: number, width: number): number {
  const d = Math.abs(distance) / width;
  if (d >= 1) return 0;
  const v = 1 - d;
  return v * v * (3 - 2 * v);
}

/**
 * Deterministic weight for one edge at one epoch, in -1..1.
 *
 * The `1 - epoch/EPOCHS * 0.55` term is the training story: early epochs throw
 * wide, wild weights and later ones settle toward smaller, more uniform ones.
 */
function weightAt(layer: number, from: number, to: number, epoch: number): number {
  const base = h(layer * 31.7 + from * 7.3, to * 11.9 + epoch * 3.1) * 2 - 1;
  const settle = 1 - (epoch / EPOCHS) * 0.55;
  return base * settle;
}

export const neuralTraining: FieldSource = (o, { cols, rows, t }) => {
  // The field sets an 8-unit glow for its chunky hero silhouettes. At this cell
  // size that is eight *cells* of bleed, which welds every edge into its
  // neighbours and turns the network into one blob. A network is mostly empty
  // space and the empty space is the subject, so the glow comes right down.
  o.shadowBlur = 1.5;

  const cycle = (t * RATE) % 1;
  const epoch = Math.floor((t * RATE) % EPOCHS);

  // Phase boundaries. Forward is given the most room because it is the part a
  // viewer reads as "the network is doing something".
  const FORWARD_END = 0.4;
  const LOSS_END = 0.5;
  const BACKWARD_END = 0.9;

  const marginX = cols * 0.19;
  const spanX = cols - marginX * 2;
  const layers: Node[][] = LAYERS.map((count, li) => {
    const x = marginX + (spanX * li) / (LAYERS.length - 1);
    const gap = rows * 0.155;
    const height = gap * (count - 1);
    return Array.from({ length: count }, (_, ni) => ({
      x,
      y: rows * 0.5 - height / 2 + gap * ni,
    }));
  });

  // Where the front is, and which way it is travelling.
  let frontX = -1;
  let backward = false;
  if (cycle < FORWARD_END) {
    frontX = marginX + spanX * (cycle / FORWARD_END);
  } else if (cycle < LOSS_END) {
    frontX = cols;
  } else if (cycle < BACKWARD_END) {
    backward = true;
    const p = (cycle - LOSS_END) / (BACKWARD_END - LOSS_END);
    frontX = marginX + spanX * (1 - p);
  }

  const frontWidth = cols * 0.14;

  // For every node, which unit in the previous layer feeds it most strongly.
  // Precomputed so the edge loop can keep that one edge even when it is weak.
  const strongestInto: number[][] = [];
  for (let li = 0; li < layers.length - 1; li++) {
    const a = layers[li]!;
    const b = layers[li + 1]!;
    strongestInto[li] = b.map((_, j) => {
      let best = 0;
      let bestAbs = -1;
      for (let i = 0; i < a.length; i++) {
        const abs = Math.abs(weightAt(li, i, j, epoch));
        if (abs > bestAbs) {
          bestAbs = abs;
          best = i;
        }
      }
      return best;
    });
  }

  // ---- edges ----
  for (let li = 0; li < layers.length - 1; li++) {
    const a = layers[li]!;
    const b = layers[li + 1]!;
    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b.length; j++) {
        const from = a[i]!;
        const to = b[j]!;
        // Sparse connectivity: fully connected reads as a solid block at this
        // cell size, so weak edges are dropped. But a node with every edge
        // dropped floats unattached, which is not a picture of a network — so
        // each node keeps its strongest incoming edge regardless of threshold.
        const w = weightAt(li, i, j, epoch);
        if (Math.abs(w) < EDGE_THRESHOLD && strongestInto[li]![j] !== i) continue;

        const midX = (from.x + to.x) / 2;
        const heat = frontX < 0 ? 0 : bump(midX - frontX, frontWidth);

        // Forward emphasises the nodes, backward emphasises the edges — that
        // asymmetry is what makes the two passes distinguishable at a glance.
        const gain = backward ? 1 + heat * 2.6 : 1 + heat * 0.7;
        o.lineWidth = Math.max(0.3, Math.abs(w) * rows * 0.009 * gain);
        o.beginPath();
        o.moveTo(from.x, from.y);
        o.lineTo(to.x, to.y);
        o.stroke();
      }
    }
  }

  // ---- nodes ----
  layers.forEach((layer, li) => {
    const isOutput = li === layers.length - 1;
    for (const n of layer) {
      const heat = frontX < 0 ? 0 : bump(n.x - frontX, frontWidth);
      const activation = backward ? 0.25 : heat;
      const r = rows * 0.017 * (1 + activation * 1.6);
      o.beginPath();
      o.arc(n.x, n.y, r, 0, 7);
      o.fill();

      // During the loss phase the output layer carries its error marks: a short
      // bar beside each output node, length standing for that unit's residual.
      if (isOutput && cycle >= FORWARD_END && cycle < LOSS_END) {
        const err = Math.abs(weightAt(9, li, layer.indexOf(n), epoch));
        const len = rows * 0.03 + err * rows * 0.09;
        o.lineWidth = rows * 0.018;
        o.beginPath();
        o.moveTo(n.x + rows * 0.05, n.y);
        o.lineTo(n.x + rows * 0.05 + len, n.y);
        o.stroke();
      }
    }
  });

  // ---- epoch ticks ----
  // A row of marks along the bottom, one per completed epoch. It is the only
  // part that says this is a loop rather than a single run.
  const tickY = rows * 0.93;
  const tickW = rows * 0.03;
  for (let e = 0; e < EPOCHS; e++) {
    const x = marginX + (spanX * e) / (EPOCHS - 1);
    if (e < epoch) {
      o.fillRect(x - tickW / 2, tickY, tickW, tickW);
    } else if (e === epoch) {
      const grow = tickW * (0.5 + cycle * 0.9);
      o.fillRect(x - grow / 2, tickY + (tickW - grow) / 2, grow, grow);
    }
  }
};
