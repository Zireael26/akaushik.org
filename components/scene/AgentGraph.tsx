'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Raw-three port of the previous `@react-three/fiber` implementation.
// Why: R3F + drei + three composite into the ~820 KiB chunk that
// Next 16's preloader was pulling on first paint despite the
// `next/dynamic({ ssr: false })` boundary in AgentGraphClient.tsx —
// dropping R3F sheds the framework layer and brings the initial-load
// JS measurably down. The Wanderer scene uses the same raw-three
// shape, so the project now has one consistent 3D pattern.
//
// Design invariants (unchanged from the R3F version):
//   - runs only client-side (loaded via next/dynamic ssr: false)
//   - `prefers-reduced-motion: reduce` + [data-motion="off"] are
//     enforced upstream by AgentGraphClient.tsx; if either is set,
//     this component is not rendered at all and the SVG fallback
//     stays visible.
//   - canvas carries aria-hidden so screen readers ignore the
//     decoration.

type NodeDef = {
  label: string;
  pos: [number, number, number];
  size: number;
  hub?: boolean;
};

const NODE_DEFS: ReadonlyArray<NodeDef> = [
  { label: 'orchestrator', pos: [0, 0, 0], size: 0.46, hub: true },
  { label: 'reasoning', pos: [-1.85, 1.1, -0.3], size: 0.3 },
  { label: 'tools', pos: [1.9, 0.7, 0.2], size: 0.26 },
  { label: 'memory', pos: [0.1, -1.75, 0.1], size: 0.28 },
];

const EDGE_PAIRS: ReadonlyArray<[number, number]> = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [2, 3],
  [3, 1],
];

type ColorRead = {
  accent: THREE.Color;
  ink: THREE.Color;
  bg: THREE.Color;
  satellite: THREE.Color;
  edge: THREE.Color;
};

function readColors(): ColorRead {
  if (typeof window === 'undefined') {
    return {
      accent: new THREE.Color('#13423D'),
      ink: new THREE.Color('#1A1A1E'),
      bg: new THREE.Color('#F5F1E8'),
      satellite: new THREE.Color('#13423D').lerp(new THREE.Color('#F5F1E8'), 0.35),
      edge: new THREE.Color('#1A1A1E').lerp(new THREE.Color('#F5F1E8'), 0.55),
    };
  }
  const cs = getComputedStyle(document.documentElement);
  const accent = new THREE.Color(cs.getPropertyValue('--accent').trim() || '#13423D');
  const ink = new THREE.Color(cs.getPropertyValue('--ink').trim() || '#1A1A1E');
  const bg = new THREE.Color(cs.getPropertyValue('--bg').trim() || '#F5F1E8');
  return {
    accent,
    ink,
    bg,
    satellite: accent.clone().lerp(bg, 0.35),
    edge: ink.clone().lerp(bg, 0.55),
  };
}

function makeLabelSprite(text: string, hexColor: string): THREE.Sprite {
  const fontPx = 40;
  const pad = 12;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('AgentGraph: no 2d canvas context');
  ctx.font = `500 ${fontPx}px "JetBrains Mono", ui-monospace, monospace`;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  const h = fontPx + pad * 2;
  canvas.width = w;
  canvas.height = h;
  const ctx2 = canvas.getContext('2d');
  if (!ctx2) throw new Error('AgentGraph: no 2d canvas context (2)');
  ctx2.font = `500 ${fontPx}px "JetBrains Mono", ui-monospace, monospace`;
  ctx2.textAlign = 'center';
  ctx2.textBaseline = 'middle';
  ctx2.fillStyle = hexColor;
  ctx2.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 10;
  const scaleFactor = 0.0022;
  sprite.scale.set(w * scaleFactor, h * scaleFactor, 1);
  return sprite;
}

export default function AgentGraph() {
  const hostRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      // WebGL unavailable — SVG fallback stays visible.
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    const sizeRect = host.getBoundingClientRect();
    renderer.setSize(sizeRect.width, sizeRect.height, false);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      35,
      sizeRect.width / Math.max(sizeRect.height, 1),
      0.1,
      100,
    );
    camera.position.set(0, 0, 8.4);

    scene.add(new THREE.DirectionalLight(0xffffff, 0.9).translateX(3).translateY(4).translateZ(5));
    scene.add(new THREE.DirectionalLight(0xffffff, 0.35).translateX(-4).translateY(-2).translateZ(3));
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    const colors = readColors();
    const group = new THREE.Group();
    scene.add(group);

    type NodeRef = {
      def: NodeDef;
      mesh: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshStandardMaterial>;
      ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
      label: THREE.Sprite;
      basePos: THREE.Vector3;
      labelYOff: number;
    };

    const nodes: NodeRef[] = NODE_DEFS.map((def) => {
      const geo = new THREE.IcosahedronGeometry(def.size, 1);
      const mat = new THREE.MeshStandardMaterial({
        color: def.hub ? colors.accent : colors.satellite,
        roughness: 0.55,
        metalness: 0.1,
        flatShading: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(def.pos[0], def.pos[1], def.pos[2]);
      group.add(mesh);

      const ringGeo = new THREE.RingGeometry(def.size * 1.55, def.size * 1.58, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: colors.accent,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(mesh.position);
      group.add(ring);

      const inkHex = '#' + colors.ink.getHexString();
      const label = makeLabelSprite(def.label, inkHex);
      const yOff = def.hub ? def.size + 0.32 : -(def.size + 0.28);
      label.position.set(def.pos[0], def.pos[1] + yOff, def.pos[2]);
      group.add(label);

      return { def, mesh, ring, label, basePos: mesh.position.clone(), labelYOff: yOff };
    });

    type EdgeRef = {
      pair: readonly [number, number];
      line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    };

    const edges: EdgeRef[] = EDGE_PAIRS.map((pair) => {
      const a = nodes[pair[0]];
      const b = nodes[pair[1]];
      if (!a || !b) throw new Error(`AgentGraph: edge refers to missing node ${pair}`);
      const geom = new THREE.BufferGeometry().setFromPoints([
        a.basePos.clone(),
        b.basePos.clone(),
      ]);
      const mat = new THREE.LineBasicMaterial({
        color: colors.edge,
        transparent: true,
        opacity: 0.5,
      });
      const line = new THREE.Line(geom, mat);
      group.add(line);
      return { pair, line };
    });

    const packetGeo = new THREE.SphereGeometry(0.05, 12, 12);
    const packetMat = new THREE.MeshBasicMaterial({ color: colors.accent });

    type PacketRef = {
      pair: readonly [number, number];
      mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
      t: number;
      speed: number;
      dir: 1 | -1;
    };

    const packets: PacketRef[] = EDGE_PAIRS.map((pair, i) => {
      const mesh = new THREE.Mesh(packetGeo, packetMat);
      group.add(mesh);
      return {
        pair,
        mesh,
        t: Math.random(),
        speed: 0.11 + Math.random() * 0.06,
        dir: (i % 2 ? 1 : -1) as 1 | -1,
      };
    });

    // Theme + accent sync via MutationObserver, mutating materials in place.
    const applyColors = () => {
      const c = readColors();
      const inkHex = '#' + c.ink.getHexString();
      nodes.forEach((n) => {
        n.mesh.material.color.copy(n.def.hub ? c.accent : c.satellite);
        n.ring.material.color.copy(c.accent);
        const next = makeLabelSprite(n.def.label, inkHex);
        if (n.label.material.map) n.label.material.map.dispose();
        n.label.material.dispose();
        n.label.material = next.material;
        n.label.scale.copy(next.scale);
      });
      edges.forEach((e) => e.line.material.color.copy(c.edge));
      packetMat.color.copy(c.accent);
    };
    const mo = new MutationObserver(applyColors);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-mode', 'data-accent'],
    });

    // Resize handling.
    const ro = new ResizeObserver(() => {
      const rect = host.getBoundingClientRect();
      camera.aspect = rect.width / Math.max(rect.height, 1);
      camera.updateProjectionMatrix();
      // Re-read DPR so moving the window between a standard and a HiDPI
      // display mid-session keeps the canvas sharp rather than stuck at the
      // pixel ratio captured at mount.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(rect.width, rect.height, false);
    });
    ro.observe(host);

    // Pointer parallax.
    const onMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointerRef.current.tx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerRef.current.ty = -((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    const onLeave = () => {
      pointerRef.current.tx = 0;
      pointerRef.current.ty = 0;
    };
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);

    // RAF loop.
    const startedAt = performance.now();
    let raf = 0;
    const tick = () => {
      const t = (performance.now() - startedAt) / 1000;
      const p = pointerRef.current;
      p.x += (p.tx - p.x) * 0.06;
      p.y += (p.ty - p.y) * 0.06;
      group.rotation.y = p.x * 0.25 + Math.sin(t * 0.15) * 0.05;
      group.rotation.x = -p.y * 0.18 + Math.cos(t * 0.17) * 0.04;

      nodes.forEach((n, i) => {
        const base = n.basePos;
        n.mesh.position.set(
          base.x + Math.sin(t * 0.6 + i) * 0.04,
          base.y + Math.cos(t * 0.5 + i * 1.3) * 0.05,
          base.z + Math.sin(t * 0.4 + i * 2.1) * 0.03,
        );
        n.ring.position.copy(n.mesh.position);
        n.ring.rotation.x += 0.003;
        n.ring.rotation.y += 0.004;
        n.label.position.set(
          n.mesh.position.x,
          n.mesh.position.y + n.labelYOff,
          n.mesh.position.z,
        );
        n.mesh.rotation.y += 0.002;
      });

      edges.forEach((e) => {
        const posAttr = e.line.geometry.attributes.position as THREE.BufferAttribute;
        const nodeA = nodes[e.pair[0]];
        const nodeB = nodes[e.pair[1]];
        if (!nodeA || !nodeB) return;
        const pa = nodeA.mesh.position;
        const pb = nodeB.mesh.position;
        posAttr.setXYZ(0, pa.x, pa.y, pa.z);
        posAttr.setXYZ(1, pb.x, pb.y, pb.z);
        posAttr.needsUpdate = true;
      });

      packets.forEach((pk) => {
        pk.t += pk.speed * pk.dir * 0.016;
        if (pk.t > 1) pk.t -= 1;
        if (pk.t < 0) pk.t += 1;
        const nodeA = nodes[pk.pair[0]];
        const nodeB = nodes[pk.pair[1]];
        if (!nodeA || !nodeB) return;
        pk.mesh.position.lerpVectors(nodeA.mesh.position, nodeB.mesh.position, pk.t);
      });

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      ro.disconnect();
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      nodes.forEach((n) => {
        n.mesh.geometry.dispose();
        n.mesh.material.dispose();
        n.ring.geometry.dispose();
        n.ring.material.dispose();
        if (n.label.material.map) n.label.material.map.dispose();
        n.label.material.dispose();
      });
      edges.forEach((e) => {
        e.line.geometry.dispose();
        e.line.material.dispose();
      });
      packetGeo.dispose();
      packetMat.dispose();
      renderer.dispose();
      // dispose() releases GL objects but not the drawing context itself;
      // forceContextLoss() frees the underlying WebGL context so repeated
      // mount/unmount (Fast Refresh, edit-mode motion toggles) can't leak
      // contexts toward the browser's per-page cap.
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="scene-canvas-host"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0 }}
    />
  );
}
