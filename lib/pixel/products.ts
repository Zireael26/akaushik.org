import { h } from '../pixel';
import type { FieldSource } from './field';

export const PRODUCT_SLUGS = [
  'vericite',
  'neev',
  'bluehost-agents',
  'curat-money',
  'clusterbid',
] as const;

export type ProductSlug = (typeof PRODUCT_SLUGS)[number];

const TAU = Math.PI * 2;

/** A stable, bounded per-product variation. Callers provide seedFrom(slug). */
function jitter(seed: number, channel: number, epoch = 0): number {
  return h(seed * 0.617 + channel * 17.13, seed * 0.113 + channel * 3.71 + epoch * 11.91);
}

function signedJitter(seed: number, channel: number, epoch = 0): number {
  return jitter(seed, channel, epoch) * 2 - 1;
}

function clamp01(value: number): number {
  return value <= 0 ? 0 : value >= 1 ? 1 : value;
}

function smooth(value: number): number {
  const p = clamp01(value);
  return p * p * (3 - p * 2);
}

function phase(cycle: number, start: number, end: number): number {
  return smooth((cycle - start) / (end - start));
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function strokeWidth(rows: number, scale = 0.024): number {
  return Math.max(0.75, Math.min(1, rows * scale));
}

function segment(
  o: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  width: number,
): void {
  o.lineWidth = width;
  o.beginPath();
  o.moveTo(ax, ay);
  o.lineTo(bx, by);
  o.stroke();
}


function rankByKey(seed: number, row: number, count: number, channel: number): number {
  const key = jitter(seed, channel + row * 1.71);
  let rank = 0;
  for (let other = 0; other < count; other++) {
    if (other === row) continue;
    const otherKey = jitter(seed, channel + other * 1.71);
    if (otherKey < key || (otherKey === key && other < row)) rank++;
  }
  return rank;
}

/**
 * Query → embedding → vector store → cited answer.
 *
 * The answer card and return path are present in the resting frame. Motion only
 * advances the retrieval: query packet, selected stored chunk, answer assembly,
 * then the citation travelling back to its evidence.
 */
export const vericite: FieldSource = (o, { cols, rows, t, seed }) => {
  const compact = rows < 40;
  const cycle = fract(t * 0.28);
  const line = strokeWidth(rows, 0.022);
  const queryX = cols * 0.055;
  const queryY = rows * 0.36;
  const queryW = cols * 0.12;
  const queryH = Math.max(8, rows * 0.28);
  const embedX = cols * 0.235;
  const spineY = rows * 0.55;
  const storeX = cols * 0.37;
  const storeY = rows * 0.205;
  const storeW = cols * 0.25;
  const storeH = rows * 0.59;
  const storeRows = compact ? 1 : 3;
  const storeGap = rows * 0.014;
  const storePitch = storeH / (storeRows + 1);
  const match = Math.floor(jitter(seed, 11) * storeRows);
  const matchY = storeY + storePitch * (match + 1);
  const answerX = cols * 0.69;
  const answerY = rows * 0.195;
  const answerW = cols * 0.255;
  const answerH = rows * 0.6;
  const queryPulse = phase(cycle, 0, 0.12);
  const retrieve = phase(cycle, 0.32, 0.58);
  const assemble = phase(cycle, 0.56, 0.84);
  const cite = phase(cycle, 0.78, 0.94);

  o.save();
  o.shadowBlur = 1.5;

  // Query: a compact request card that resolves to a single readable rule.
  o.lineWidth = line;
  o.strokeRect(queryX, queryY, queryW, queryH);
  if (queryPulse <= 0) {
    segment(
      o,
      queryX + queryW * 0.18,
      queryY + queryH * 0.5,
      queryX + queryW * (0.72 + jitter(seed, 12) * 0.08),
      queryY + queryH * 0.5,
      line,
    );
  }
  if (queryPulse > 0) {
    const pulseW = queryW * (0.08 + queryPulse * 0.12);
    const pulseH = queryH * (0.08 + queryPulse * 0.12);
    o.fillRect(queryX + queryW * 0.5 - pulseW * 0.5, queryY + queryH * 0.5 - pulseH * 0.5, pulseW, pulseH);
  }

  // Two stations on a hero, one on a compact card; the pitch keeps them apart.
  const encoderBars = compact ? 1 : 2;
  const encoderPitch = 0.2;
  for (let bar = 0; bar < encoderBars; bar++) {
    const y = spineY + (bar - (encoderBars - 1) * 0.5) * rows * encoderPitch;
    const w = cols * (0.038 + jitter(seed, 20 + bar) * 0.012);
    o.strokeRect(embedX, y - rows * 0.012, w, Math.max(1, rows * 0.024));
    if (cycle >= 0.18 && cycle <= 0.42) {
      const encode = phase(cycle, 0.18 + bar * 0.035, 0.31 + bar * 0.035);
      o.strokeRect(embedX + line, y - rows * 0.012, Math.max(0, (w - line * 2) * encode), Math.max(1, rows * 0.024));
    }
  }

  // The quiet conduit keeps all four stations legible before animation starts.
  segment(o, queryX + queryW, spineY, embedX, spineY, line);
  segment(o, embedX + cols * 0.052, spineY, storeX, spineY, line);
  segment(o, storeX + storeW, spineY, answerX, spineY, line);
  // Vector store: three ruled rows at hero scale, with a deterministic hit mark.
  for (let row = 0; row < storeRows; row++) {
    const y = storeY + storePitch * (row + 1);
    segment(o, storeX + storeGap, y, storeX + storeW - storeGap, y, line);
    if (row === match) {
      const scanW = (storeW - storeGap * 4) * (0.2 + retrieve * 0.8);
      const mark = Math.max(1, Math.min(storePitch * 0.24, storeW * 0.04));
      const markY = y - mark * 0.5;
      o.fillRect(storeX + storeGap * 2, markY, mark, mark);
      if (retrieve > 0.5) {
        o.fillRect(storeX + storeGap * 2 + Math.max(0, scanW - mark), markY, mark, mark);
      }
    }
  }

  // Answer: frame, answer rule, quotation hooks, and a visible evidence return.
  o.lineWidth = line;
  o.strokeRect(answerX, answerY, answerW, answerH);
  const quote = Math.max(1, rows * 0.038);
  segment(o, answerX + answerW * 0.16, answerY + answerH * 0.17, answerX + answerW * 0.16, answerY + answerH * 0.3, line);
  segment(o, answerX + answerW * 0.16, answerY + answerH * 0.3, answerX + answerW * 0.24, answerY + answerH * 0.24, line);
  const answerRuleY = answerY + answerH * 0.42;
  const answerRuleW = answerW * (0.62 + jitter(seed, 45) * 0.07);
  o.strokeRect(answerX + answerW * 0.16, answerRuleY, answerRuleW, Math.max(1, answerH * 0.045));
  const answerProgress = clamp01(assemble);
  if (answerProgress > 0) {
    o.strokeRect(answerX + answerW * 0.16, answerRuleY, answerRuleW * answerProgress, Math.max(1, answerH * 0.045));
  }
  const citationY = answerY + answerH * 0.88;
  // The diagonal alone makes the evidence return legible without a parallel rule.
  segment(o, answerX + answerW * 0.14, citationY, storeX + storeW, matchY, line);
  if (cite > 0) {
    const markerX = lerp(answerX + answerW * 0.14, storeX + storeW, cite);
    const markerY = lerp(citationY, matchY, cite);
    o.fillRect(markerX - quote * 0.5, markerY - quote * 0.5, quote, quote);
  }

  // One packet performs the causal request → embedding → retrieval journey.
  if (cycle >= 0.08 && cycle < 0.4) {
    const progress = phase(cycle, 0.08, 0.4);
    const packetX = lerp(queryX + queryW, storeX + storeW * 0.28, progress);
    o.fillRect(packetX, spineY - rows * 0.032, Math.max(1, rows * 0.055), Math.max(1, rows * 0.064));
  }

  o.restore();
};

/**
 * Irregular incoming messages become one ruled ledger row each.
 *
 * Bubble outlines and the complete ledger are persistent. The animated pass
 * moves a message toward the parser, then reveals its own ruled ledger row left
 * to right; timing comes from cumulative seeded gaps rather than a metronome.
 */
export const neev: FieldSource = (o, { cols, rows, t, seed }) => {
  const compact = rows < 40;
  const micro = rows < 30;
  const cycle = fract(t * 0.24);
  const line = strokeWidth(rows, 0.022);
  const bubbleCount = micro ? 1 : compact ? 2 : 3;
  const timingCount = 6;
  const ledgerColumns = micro ? 1 : compact ? 2 : 3;
  const chatX = cols * 0.045;
  const chatW = cols * 0.275;
  const chatTop = rows * 0.17;
  const chatBottom = rows * 0.82;
  const bubbleH = Math.max(8, rows * (micro ? 0.1 : compact ? 0.07 : 0.055));
  const parserX = cols * 0.405;
  const parserY = rows * 0.37;
  const parserW = cols * 0.082;
  const parserH = Math.max(8, rows * 0.3);
  const parserMark = Math.max(1, Math.min(parserW * 0.18, rows * 0.04));
  const ledgerX = cols * 0.55;
  const ledgerY = rows * 0.17;
  const ledgerW = cols * 0.405;
  const ledgerH = rows * 0.65;
  const ledgerRowH = ledgerH / bubbleCount;
  const ledgerColW = ledgerW / ledgerColumns;
  let totalGap = 0;

  for (let message = 0; message < timingCount; message++) {
    totalGap += 0.7 + jitter(seed, 100 + message) * 0.8;
  }

  o.save();
  o.shadowBlur = 1.5;

  // The parsing gate is intentionally a distinct middle station, not a logo.
  o.lineWidth = line;
  o.strokeRect(parserX, parserY, parserW, parserH);
  segment(o, parserX + parserW * 0.28, parserY + parserH * 0.28, parserX + parserW * 0.62, parserY + parserH * 0.5, line);
  segment(o, parserX + parserW * 0.62, parserY + parserH * 0.5, parserX + parserW * 0.28, parserY + parserH * 0.72, line);
  o.fillRect(parserX + parserW * 0.5 - parserMark * 0.5, parserY + parserH * 0.5 - parserMark * 0.5, parserMark, parserMark);

  o.strokeRect(ledgerX, ledgerY, ledgerW, ledgerH);
  if (!micro) {
    for (let column = 1; column < ledgerColumns; column++) {
      segment(o, ledgerX + ledgerColW * column, ledgerY, ledgerX + ledgerColW * column, ledgerY + ledgerH, line);
    }
    for (let row = 1; row < bubbleCount; row++) {
      segment(o, ledgerX, ledgerY + ledgerRowH * row, ledgerX + ledgerW, ledgerY + ledgerRowH * row, line);
    }
  }

  let cumulativeGap = 0;
  for (let message = 0; message < timingCount; message++) {
    const bubbleW = chatW * (0.54 + jitter(seed, 120 + message) * 0.25);
    const bubbleX = chatX + (message % 2) * chatW * 0.13;
    const bubbleY =
      message < bubbleCount
        ? lerp(chatTop, chatBottom - bubbleH, message / Math.max(1, bubbleCount - 1))
        : lerp(chatTop, chatBottom - bubbleH, message / (timingCount - 1));
    const tail = Math.max(1, bubbleH * 0.18);
    const start = 0.06 + (cumulativeGap / totalGap) * 0.62;
    const arrivalEnd = start + 0.06;
    const parseEnd = arrivalEnd + 0.07;
    const fillEnd = parseEnd + 0.11;
    const arrive = phase(cycle, start, arrivalEnd);
    const parsed = phase(cycle, parseEnd, fillEnd);
    const clear = 1 - phase(cycle, 0.9, 1);
    const rowY = ledgerY + ledgerRowH * message;

    cumulativeGap += 0.7 + jitter(seed, 100 + message) * 0.8;

    if (message < bubbleCount) {
      // Message bubbles use rectilinear tails so they survive the coarse grid.
      o.lineWidth = line;
      o.strokeRect(bubbleX, bubbleY, bubbleW, bubbleH);
      if (message % 2 === 0) {
        segment(o, bubbleX + tail, bubbleY + bubbleH, bubbleX, bubbleY + bubbleH + tail, line);
        segment(o, bubbleX, bubbleY + bubbleH + tail, bubbleX + tail * 2, bubbleY + bubbleH, line);
      } else {
        segment(o, bubbleX + bubbleW - tail, bubbleY + bubbleH, bubbleX + bubbleW, bubbleY + bubbleH + tail, line);
        segment(o, bubbleX + bubbleW, bubbleY + bubbleH + tail, bubbleX + bubbleW - tail * 2, bubbleY + bubbleH, line);
      }
    }

    // Arrival travels toward parsing before this message is allowed to reveal a row.
    if (arrive > 0 && arrive < 1) {
      const packetX = lerp(bubbleX + bubbleW, parserX, arrive);
      const packetY = lerp(bubbleY + bubbleH * 0.5, parserY + parserH * 0.5, arrive);
      o.fillRect(packetX, packetY - rows * 0.025, Math.max(1, rows * 0.045), Math.max(1, rows * 0.05));
    }
    if (cycle >= arrivalEnd && cycle < parseEnd) {
      const activeMark = Math.max(1, parserMark * 0.5);
      o.fillRect(
        parserX + parserW * 0.74 - activeMark * 0.5,
        parserY + parserH * 0.5 - activeMark * 0.5,
        activeMark,
        activeMark,
      );
    }

    if (message >= bubbleCount) continue;
    const rowProgress = parsed * clear;
    for (let column = 0; column < ledgerColumns; column++) {
      const cellProgress = clamp01(rowProgress * ledgerColumns - column);
      if (cellProgress <= 0) continue;
      const x = ledgerX + ledgerColW * column + ledgerColW * 0.14;
      const y = rowY + ledgerRowH * 0.5;
      const width = ledgerColW * (0.44 + jitter(seed, 160 + message * 7 + column) * 0.24) * cellProgress;
      segment(o, x, y, x + width, y, line);
    }
  }

  // A short structured conduit makes the gate's output direction explicit.
  segment(o, parserX + parserW, parserY + parserH * 0.5, ledgerX, parserY + parserH * 0.5, line);

  o.restore();
};

/**
 * A fleet of agents dispatches to a runtime bar. Each lane has its own clock,
 * active fraction, endpoint and dwell, so the frame shows concurrent work
 * rather than a global pulse.
 */
export const bluehostAgents: FieldSource = (o, { cols, rows, t, seed }) => {
  const compact = rows < 40;
  const count = compact ? 2 : 3;
  const line = strokeWidth(rows, 0.02);
  const barX = cols * 0.1;
  const barW = cols * 0.8;
  const barH = Math.max(8, rows * 0.095);
  const barY = rows - barH - 0.5;
  const marker = Math.max(1, rows * 0.042);

  o.save();
  o.shadowBlur = 1.5;

  o.lineWidth = line;
  o.strokeRect(barX, barY, barW, barH);
  for (let agent = 0; agent < count; agent++) {
    const fraction = (agent + 0.5) / count;

    const agentX = cols * (0.12 + fraction * 0.76 + signedJitter(seed, 200 + agent) * 0.012);
    const agentY = rows * (0.19 + (agent % 2) * 0.19 + signedJitter(seed, 210 + agent) * 0.018);
    const endX = barX + barW * (0.16 + fraction * 0.68 + signedJitter(seed, 220 + agent) * 0.025);
    const endY = barY + barH * 0.5;
    const radius = Math.max(1, rows * 0.034);
    const speed = 0.19 + jitter(seed, 230 + agent) * 0.1;
    const local = fract(t * speed + jitter(seed, 240 + agent));
    const active = 0.55 + jitter(seed, 250 + agent) * 0.35;

    o.beginPath();
    o.arc(agentX, agentY, radius, 0, TAU);
    o.fill();
    segment(o, agentX, agentY + radius, endX, endY, line);

    if (local >= active) continue;

    const call = local / active;
    let stemProgress = 0;
    let returning = false;
    if (call < 0.42) {
      stemProgress = smooth(call / 0.42);
    } else if (call < 0.62) {
      stemProgress = 1;
    } else {
      stemProgress = 1 - smooth((call - 0.62) / 0.38);
      returning = true;
    }

    // Both directions interpolate x and y on the real sloped stem.
    const packetX = lerp(agentX, endX, stemProgress);
    const packetY = lerp(agentY, endY, stemProgress);
    if (returning) {
      o.lineWidth = line;
      o.strokeRect(packetX - marker * 0.5, packetY - marker * 0.5, marker, marker);
    } else {
      o.fillRect(packetX - marker * 0.5, packetY - marker * 0.5, marker, marker);
    }
  }

  o.restore();
};

/**
 * A neutral data feeder feeds a complete comparison grid. The data rows start
 * in a seeded intake permutation and settle into their score ranks; rows are
 * never authored already sorted.
 */
export const curatMoney: FieldSource = (o, { cols, rows, t, seed }) => {
  const compact = rows < 40;
  const cycle = fract(t * 0.2);
  const line = strokeWidth(rows, 0.022);
  const rowCount = compact ? 1 : 2;
  const feederX = cols * (0.145 + signedJitter(seed, 380) * 0.002);
  const feederTop = rows * 0.24;
  const feederBottom = rows * 0.76;
  const feederBox = Math.max(8, rows * 0.075);
  const gridX = cols * 0.36;
  const gridY = rows * 0.17;
  const gridW = cols * 0.59;
  const gridH = rows * 0.66;
  const rowPitch = gridH / rowCount;
  const settle = phase(cycle, 0.42, 0.8);
  const stamp = phase(cycle, 0.8, 0.95);
  let samePermutation = true;

  for (let row = 0; row < rowCount; row++) {
    if (rankByKey(seed, row, rowCount, 300) !== rankByKey(seed, row, rowCount, 340)) {
      samePermutation = false;
      break;
    }
  }

  o.save();
  o.shadowBlur = 1.5;

  // The left chute is deliberately vertical, unlike the other product fields.
  segment(o, feederX, feederTop, feederX, feederBottom, line);
  const feederY = (feederTop + feederBottom) * 0.5;
  o.lineWidth = line;
  o.strokeRect(feederX - feederBox * 0.5, feederY - feederBox * 0.5, feederBox, feederBox);
  segment(o, feederX + feederBox * 0.5, rows * 0.5, gridX, rows * 0.5, line);
  const feed = phase(cycle, 0, 0.42);
  if (feed > 0) {
    const packetY = lerp(feederTop, feederBottom, feed);
    o.fillRect(feederX - feederBox * 0.125, packetY - feederBox * 0.125, feederBox * 0.25, feederBox * 0.25);
  }

  // Shared rubric: one outer frame and two deliberately spaced scoring columns.
  o.lineWidth = line;
  o.strokeRect(gridX, gridY, gridW, gridH);
  segment(o, gridX + gridW * 0.5, gridY, gridX + gridW * 0.5, gridY + gridH, line);
  for (let row = 0; row < rowCount; row++) {
    const sourceSlot = rankByKey(seed, row, rowCount, 300);
    const initialSlot = samePermutation ? (sourceSlot + 1) % rowCount : sourceSlot;
    const rankedSlot = rankByKey(seed, row, rowCount, 340);
    const slot = lerp(initialSlot, rankedSlot, settle);
    const y = gridY + rowPitch * (slot + 0.35);
    const rowH = Math.min(8, rowPitch * 0.46);
    // The moving row stays inset from the rubric frame, so adjacent rules do not weld.
    o.lineWidth = line;
    o.strokeRect(gridX + gridW * 0.12, y, gridW * 0.6, rowH);
    if (stamp > 0) {
      const railX = gridX + gridW * 0.86;
      const railY = gridY + rowPitch * (rankedSlot + 0.39);
      o.fillRect(railX, railY, gridW * 0.025 * stamp, Math.max(1, rowPitch * 0.13));
    }
  }

  // The rank rail only stamps after the rows have visibly settled.
  segment(o, gridX + gridW * 0.86, gridY, gridX + gridW * 0.86, gridY + gridH, line);

  o.restore();
};

/**
 * CI checks converge on a scheduler, then trace only the non-UAT pod columns.
 * The final UAT column is always wireframe; even the last packet stops at its
 * boundary so the unfinished pre-production state cannot be mistaken for live.
 */
export const clusterbid: FieldSource = (o, { cols, rows, t, seed }) => {
  const compact = rows < 40;
  const cycle = fract(t * 0.3);
  const line = strokeWidth(rows, 0.024);
  const checkCount = compact ? 1 : 2;
  const checkX = cols * 0.05;
  const checkY = rows * 0.2;
  const checkW = cols * 0.16;
  const checkH = Math.max(8, rows * 0.115);
  const checkGap = rows * (compact ? 0.3 : 0.28);
  const schedulerX = cols * (0.35 + signedJitter(seed, 420) * 0.006);
  const schedulerY = rows * 0.42;
  const schedulerW = cols * 0.11;
  const schedulerH = Math.min(Math.max(8, rows * 0.18), rows - schedulerY);
  const podX = cols * (0.54 + signedJitter(seed, 430) * 0.006);
  const podY = rows * 0.25;
  const podW = cols * 0.11;
  const podH = Math.max(8, rows * 0.18);
  const podRows = compact ? 1 : 2;
  const podColumns = 2;
  const podGapX = cols * (compact ? 0.06 : 0.035);
  const podGapY = rows * (compact ? 0.3 : 0.14);
  const marker = Math.max(1, rows * 0.043);

  o.save();
  o.shadowBlur = 1.5;
  // Sparse CI checks, already connected to the scheduler at rest.
  for (let check = 0; check < checkCount; check++) {
    const y = checkY + check * checkGap;
    const complete = phase(cycle, 0.04 + check * 0.095, 0.12 + check * 0.095);
    if (check === 0) {
      segment(o, checkX + checkW, y + checkH * 0.5, schedulerX, schedulerY + schedulerH * 0.5, line);
    }
    o.strokeRect(checkX, y, checkW, checkH);
    if (complete > 0) {
      segment(o, checkX + checkW * 0.31, y + checkH * 0.57, checkX + checkW * 0.44, y + checkH * 0.72, line);
      segment(o, checkX + checkW * 0.44, y + checkH * 0.72, checkX + checkW * 0.75, y + checkH * 0.3, line);
    }
  }

  o.lineWidth = line;
  o.strokeRect(schedulerX, schedulerY, schedulerW, schedulerH);
  segment(o, schedulerX + schedulerW, schedulerY + schedulerH * 0.5, podX, schedulerY + schedulerH * 0.5, line);

  // Scheduler receives packets after CI and sends them through only schedulable pods.
  const ingress = phase(cycle, 0.25, 0.5);
  if (ingress > 0) {
    for (let check = 0; check < checkCount; check++) {
      const startY = checkY + check * checkGap + checkH * 0.5;
      const packetX = lerp(checkX + checkW, schedulerX + schedulerW * 0.42, ingress);
      const packetY = lerp(startY, schedulerY + schedulerH * 0.5, ingress);
      o.fillRect(packetX - marker * 0.5, packetY - marker * 0.5, marker, marker);
    }
  }

  let schedulable = 0;
  for (let row = 0; row < podRows; row++) {
    for (let column = 0; column < podColumns; column++) {
      const x = podX + column * (podW + podGapX);
      const y = podY + row * (podH + podGapY);
      o.lineWidth = line;
      o.strokeRect(x, y, podW, podH);

      if (column === podColumns - 1) {
        // UAT remains outline-only: no bars, ticks, or packets enter this stage.
        continue;
      }

      const order = rankByKey(seed, schedulable, podRows, 440);
      const start = 0.5 + order * 0.07;
      const pulling = phase(cycle, start, start + 0.08);
      if (pulling > 0 && pulling < 1) {
        const pullY = y + podH * (0.18 + pulling * 0.5);
        segment(o, x + line, pullY, x + podW - line, pullY, line);
      }
      schedulable++;
    }
  }

  // The final packet reaches the UAT boundary and stops without crossing it.
  const uatBoundary = podX + (podColumns - 1) * (podW + podGapX);
  const finalPacket = phase(cycle, 0.82, 0.98);
  if (finalPacket > 0) {
    const x = lerp(schedulerX + schedulerW, uatBoundary - marker * 1.4, finalPacket);
    const y = Math.min(rows - marker * 0.5, podY + podH + podGapY * 0.5);
    o.fillRect(x, y - marker * 0.5, marker, marker);
  }

  o.restore();
};

export const productSources: Readonly<Record<ProductSlug, FieldSource>> = {
  vericite,
  neev,
  'bluehost-agents': bluehostAgents,
  'curat-money': curatMoney,
  clusterbid,
};

export function productSource(slug: string): FieldSource | null {
  switch (slug) {
    case 'vericite':
      return vericite;
    case 'neev':
      return neev;
    case 'bluehost-agents':
      return bluehostAgents;
    case 'curat-money':
      return curatMoney;
    case 'clusterbid':
      return clusterbid;
    default:
      return null;
  }
}
