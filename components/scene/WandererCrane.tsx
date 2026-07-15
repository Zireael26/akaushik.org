'use client';

import { useEffect } from 'react';
import * as THREE from 'three';

const DESKTOP_QUERY = '(min-width: 861px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const RENDERER_ATTRIBUTE = 'data-wanderer-renderer';
const POSE_ATTRIBUTE = 'data-wanderer-pose';
const MAX_RENDER_PIXELS = 1920 * 1080;

// Full port of `_reference/portfolio/companion.js` (221 LOC) to a React
// effect-mounted Three.js scene. Why not R3F: the Wanderer lives inside a
// fixed-position `#companion` host, not a bounded canvas — the parallax +
// pose choreography is driven by document-level scroll + IntersectionObserver
// on every `[data-companion-pose]` anchor. A direct `useEffect` port is a
// much cleaner read than wrapping the whole document scroll loop in R3F
// primitives, and the scene is single-instance so we don't need framework-
// managed declarative scenes.
//
// Design invariants:
//   - bails out if the desktop/motion policy changed while the lazy chunk
//     loaded, and keeps the SVG fallback if WebGL context creation throws
//   - canvas sits inside `#companion` (the Wanderer server component
//     ships the host div + fallback SVG)
//   - eight POSES drive per-section placement; lerp toward target each
//     frame via `damp = 1 - exp(-dt * 3.2)`
//   - scroll velocity modulates rotation + wing flap
//   - MutationObserver on `<html>` resyncs the accent hex on theme swap

type Pose = {
  x: number;
  y: number;
  z: number;
  rotY: number;
  rotX: number;
  scale: number;
  flap: number;
  spin: number;
};

type PoseRect = Pick<DOMRectReadOnly, 'top' | 'right' | 'bottom' | 'left' | 'width' | 'height'>;
type Viewport = { width: number; height: number };

export function calculateVisiblePoseRatios(
  geometries: ReadonlyArray<readonly [Element, PoseRect]>,
  viewport: Viewport,
): Map<Element, number> {
  const ratios = new Map<Element, number>();

  for (const [target, rect] of geometries) {
    const targetArea = rect.width * rect.height;
    if (targetArea <= 0) continue;

    const visibleWidth = Math.max(0, Math.min(rect.right, viewport.width) - Math.max(rect.left, 0));
    const visibleHeight = Math.max(
      0,
      Math.min(rect.bottom, viewport.height) - Math.max(rect.top, 0),
    );
    const ratio = Math.min(1, (visibleWidth * visibleHeight) / targetArea);
    if (ratio > 0) ratios.set(target, ratio);
  }

  return ratios;
}

export function selectDominantPose(ratios: ReadonlyMap<Element, number>): Element | null {
  let dominant: Element | null = null;
  let dominantRatio = -1;
  for (const [target, ratio] of ratios) {
    if (ratio > dominantRatio) {
      dominant = target;
      dominantRatio = ratio;
    }
  }
  return dominant;
}

const POSES: Record<string, Pose> = {
  hero: { x: 0.55, y: 0.15, z: 0, rotY: 0.3, rotX: -0.1, scale: 1.0, flap: 0.35, spin: 0.08 },
  work: { x: -0.55, y: 0.0, z: 0.5, rotY: -0.5, rotX: 0.0, scale: 0.9, flap: 0.55, spin: 0.15 },
  about: { x: 0.65, y: -0.05, z: 0.8, rotY: -1.2, rotX: 0.1, scale: 0.85, flap: 0.15, spin: 0.03 },
  writing: { x: -0.4, y: 0.25, z: 1.0, rotY: 0.9, rotX: -0.2, scale: 0.75, flap: 0.75, spin: 0.25 },
  services: { x: 0.0, y: -0.2, z: -0.5, rotY: 0.0, rotX: 0.15, scale: 1.1, flap: 0.45, spin: 0.12 },
  process: { x: 0.6, y: 0.1, z: 0, rotY: -0.4, rotX: -0.3, scale: 0.95, flap: 0.25, spin: 0.06 },
  open: { x: -0.55, y: -0.1, z: 0.3, rotY: 0.6, rotX: 0.0, scale: 0.9, flap: 0.5, spin: 0.14 },
  contact: { x: 0.35, y: -0.35, z: 1.2, rotY: 0.0, rotX: -0.15, scale: 0.7, flap: 0.2, spin: 0.05 },
};

const ACCENT_MAP: Record<string, number> = {
  forest: 0x3a5a45,
  terracotta: 0xc26a3a,
  ochre: 0xb88b2a,
  ink: 0x2a2a2a,
};

type Crane = {
  group: THREE.Group;
  wingL: THREE.Group;
  wingR: THREE.Group;
  accent: THREE.MeshStandardMaterial;
  dispose: () => void;
};

function buildCrane(): Crane {
  const group = new THREE.Group();

  const paper = new THREE.MeshStandardMaterial({
    color: 0xf5ece0,
    roughness: 0.85,
    metalness: 0.0,
    side: THREE.DoubleSide,
    flatShading: true,
  });
  const fold = new THREE.MeshStandardMaterial({
    color: 0xe8dcc8,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
    flatShading: true,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: 0x3a5a45,
    roughness: 0.8,
    metalness: 0.0,
    side: THREE.DoubleSide,
    flatShading: true,
  });

  const bodyGeo = new THREE.OctahedronGeometry(0.55, 0);
  const body = new THREE.Mesh(bodyGeo, paper);
  body.scale.set(0.6, 0.55, 1.4);
  group.add(body);

  const headGeo = new THREE.OctahedronGeometry(0.22, 0);
  const head = new THREE.Mesh(headGeo, paper);
  head.position.set(0, 0.22, 0.85);
  head.scale.set(0.9, 0.9, 1.2);
  group.add(head);

  const beakGeo = new THREE.ConeGeometry(0.08, 0.3, 4);
  const beak = new THREE.Mesh(beakGeo, accent);
  beak.position.set(0, 0.22, 1.15);
  beak.rotation.x = Math.PI / 2;
  group.add(beak);

  const tailGeom = new THREE.BufferGeometry();
  tailGeom.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0.05, -0.5, 0.15, -0.05, -1.3, -0.15, -0.05, -1.3], 3),
  );
  tailGeom.computeVertexNormals();
  const tail = new THREE.Mesh(tailGeom, fold);
  group.add(tail);

  function wing(sign: 1 | -1): THREE.Group {
    const w = new THREE.Group();
    const g1 = new THREE.BufferGeometry();
    g1.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, sign * 1.4, 0.6, -0.2, sign * 0.9, 0.1, 0.6], 3),
    );
    g1.computeVertexNormals();
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, sign * 0.9, 0.1, 0.6, sign * 0.8, -0.1, -0.5], 3),
    );
    g2.computeVertexNormals();
    w.add(new THREE.Mesh(g1, paper));
    w.add(new THREE.Mesh(g2, fold));
    w.position.set(0, 0.1, 0);
    return w;
  }
  const wingL = wing(-1);
  group.add(wingL);
  const wingR = wing(1);
  group.add(wingR);

  const dispose = () => {
    bodyGeo.dispose();
    headGeo.dispose();
    beakGeo.dispose();
    tailGeom.dispose();
    wingL.children.forEach((m) => {
      if (m instanceof THREE.Mesh) m.geometry.dispose();
    });
    wingR.children.forEach((m) => {
      if (m instanceof THREE.Mesh) m.geometry.dispose();
    });
    paper.dispose();
    fold.dispose();
    accent.dispose();
  };

  return { group, wingL, wingR, accent, dispose };
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

export default function WandererCrane() {
  useEffect(() => {
    const host = document.getElementById('companion');
    if (!host) return;

    const desktop = window.matchMedia(DESKTOP_QUERY).matches;
    const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    const motionEnabled = document.documentElement.getAttribute('data-motion') !== 'off';
    if (!desktop || reduceMotion || !motionEnabled) return;

    const svg = host.querySelector<SVGElement>('.companion-svg');

    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      host.removeChild(canvas);
      host.setAttribute(RENDERER_ATTRIBUTE, 'fallback');
      return () => host.removeAttribute(RENDERER_ATTRIBUTE);
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 8);

    const key = new THREE.DirectionalLight(0xfff0d8, 2.1);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9ab7a6, 0.9);
    rim.position.set(-4, 2, -3);
    scene.add(rim);
    const ambient = new THREE.AmbientLight(0xfff6e8, 0.45);
    scene.add(ambient);

    const crane = buildCrane();
    scene.add(crane.group);

    const current: Pose = { ...(POSES.hero as Pose) };
    const target: Pose = { ...(POSES.hero as Pose) };

    const sections = Array.from(document.querySelectorAll('[data-companion-pose]'));
    host.setAttribute(POSE_ATTRIBUTE, 'hero');
    const observer = new IntersectionObserver(
      () => {
        const visiblePoseRatios = calculateVisiblePoseRatios(
          sections.map((section) => [section, section.getBoundingClientRect()] as const),
          { width: window.innerWidth, height: window.innerHeight },
        );
        const dominant = selectDominantPose(visiblePoseRatios);
        const key = dominant?.getAttribute('data-companion-pose');
        if (!key || !POSES[key]) return;
        Object.assign(target, POSES[key]);
        host.setAttribute(POSE_ATTRIBUTE, key);
      },
      { threshold: [0.2, 0.45, 0.7] },
    );
    sections.forEach((s) => observer.observe(s));

    const pointer = { x: 0, y: 0 };
    let lastScrollY = window.scrollY;
    let scrollVel = 0;

    const onScroll = () => {
      scrollVel = (window.scrollY - lastScrollY) * 0.004;
      lastScrollY = window.scrollY;
    };
    const onPointerMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointerMove);

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const pixelBudgetRatio = Math.sqrt(MAX_RENDER_PIXELS / Math.max(1, w * h));
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5, pixelBudgetRatio));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    const syncAccent = () => {
      const a = document.documentElement.getAttribute('data-accent') || 'forest';
      crane.accent.color.setHex(ACCENT_MAP[a] ?? ACCENT_MAP.forest!);
    };
    syncAccent();
    const mo = new MutationObserver(syncAccent);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-accent', 'data-mode'],
    });

    let lastFrame = performance.now();
    let t = 0;
    let rafId = 0;

    const frame = () => {
      if (document.hidden) {
        rafId = 0;
        return;
      }
      const now = performance.now();
      const dt = Math.min((now - lastFrame) / 1000, 0.05);
      lastFrame = now;
      t += dt;
      const damp = 1 - Math.exp(-dt * 3.2);

      current.x = lerp(current.x, target.x, damp);
      current.y = lerp(current.y, target.y, damp);
      current.z = lerp(current.z, target.z, damp);
      current.rotY = lerp(current.rotY, target.rotY, damp);
      current.rotX = lerp(current.rotX, target.rotX, damp);
      current.scale = lerp(current.scale, target.scale, damp);
      current.flap = lerp(current.flap, target.flap, damp);
      current.spin = lerp(current.spin, target.spin, damp);

      const halfH = Math.tan((camera.fov * Math.PI) / 180 / 2) * camera.position.z;
      const halfW = halfH * camera.aspect;
      crane.group.position.x = current.x * halfW + pointer.x * 0.25;
      crane.group.position.y = current.y * halfH + pointer.y * 0.15 + Math.sin(t * 1.1) * 0.08;
      crane.group.position.z = current.z;

      crane.group.rotation.y = current.rotY + t * current.spin + scrollVel * 2.2;
      crane.group.rotation.x = current.rotX + Math.sin(t * 0.7) * 0.06;
      crane.group.rotation.z = Math.sin(t * 0.9) * 0.04 - scrollVel * 1.1;

      const flapSpeed = 4 + current.flap * 10;
      const flapAmt = current.flap * 0.9 + Math.abs(scrollVel) * 1.5;
      crane.wingL.rotation.z = Math.sin(t * flapSpeed) * flapAmt;
      crane.wingR.rotation.z = -Math.sin(t * flapSpeed) * flapAmt;

      crane.group.scale.setScalar(current.scale);
      scrollVel *= 0.9;

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(frame);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafId);
        rafId = 0;
        return;
      }
      if (rafId === 0) {
        lastFrame = performance.now();
        rafId = requestAnimationFrame(frame);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Warm-up render so the first visible frame has shaders compiled before
    // the SVG fallback is hidden. WebGL context creation above is already
    // guarded by try/catch — the correct failure mode for unavailable WebGL.
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(frame);

    // When the canvas is mounted, hide the SVG fallback so both don't
    // composite. `companion-svg` is the CSS selector the Wanderer server
    // component uses for its fallback polygon.
    if (svg) svg.style.display = 'none';
    host.setAttribute(RENDERER_ATTRIBUTE, 'canvas');

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      mo.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      crane.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (canvas.parentElement === host) host.removeChild(canvas);
      if (svg) svg.style.display = '';
      host.removeAttribute(RENDERER_ATTRIBUTE);
      host.removeAttribute(POSE_ATTRIBUTE);
    };
  }, []);

  return null;
}
