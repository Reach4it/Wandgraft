// A 3D model of the built wand: hilt, shaft with its socketed crystals, and tip.
// Used for the bench's wand view and for the wand in the player's hand.
// The wand lies along +X: the handle end at x = 0, the tip at x = length.
import * as THREE from 'three';
import { Material, crystal } from '../engine/data';
import { Shot } from '../engine/resolve';
import { WandBuild, fittedParts, wandStats } from '../engine/wand';

function partMaterial(m: Material, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  const base: THREE.MeshStandardMaterialParameters = { color: m.color, roughness: 0.75, metalness: 0 };
  switch (m.family) {
    case 'metal':
      Object.assign(base, { metalness: 0.85, roughness: 0.3 });
      break;
    case 'stone':
      Object.assign(base, { roughness: 0.95 });
      break;
    case 'bone':
      Object.assign(base, { roughness: 0.6 });
      break;
    case 'crystal':
      Object.assign(base, { roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.82, emissive: m.color, emissiveIntensity: 0.15 });
      break;
    case 'exotic':
      Object.assign(base, { roughness: 0.45 });
      break;
  }
  return new THREE.MeshStandardMaterial({ ...base, ...extra });
}

/** Cylinder lying along +X from x0 to x1. */
function rod(x0: number, x1: number, r0: number, r1: number, mat: THREE.Material, seg = 10): THREE.Mesh {
  const g = new THREE.CylinderGeometry(r1, r0, x1 - x0, seg);
  g.rotateZ(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.x = (x0 + x1) / 2;
  m.castShadow = true;
  return m;
}

export interface WandModel {
  group: THREE.Group;
  length: number;
  /** Local position of the tip, for glows and muzzle effects. */
  tip: THREE.Vector3;
}

export function buildWandModel(build: WandBuild, shot: Shot, glowTex?: THREE.Texture): WandModel {
  const { f, hilt, shaft, tip: tipMat } = fittedParts(build);
  const st = wandStats(build);
  const z = st.zoneSockets;
  const g = new THREE.Group();
  const twig = f.id === 'twig';
  const arch = f.id === 'archwand';
  const thick = arch ? 1.12 : 1;
  // each zone grows with the sockets it carries
  const hiltLen = hilt ? 0.24 + 0.09 * z.hilt : 0;
  const shaftLen = twig ? 0.95 : 0.42 + 0.11 * z.shaft;
  const collarLen = tipMat ? 0.05 + 0.075 * z.tip : 0;
  const headLen = tipMat ? 0.17 : 0.08;
  const length = hiltLen + shaftLen + collarLen + headLen;

  // ---- hilt: wrapped handle with a pommel; its sockets sit between the wraps ----
  if (hilt) {
    const gm = partMaterial(hilt);
    g.add(rod(0, hiltLen, 0.072 * thick, 0.066 * thick, gm, 12));
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.085 * thick, 14, 10), gm);
    pommel.castShadow = true;
    g.add(pommel);
    const wrap = new THREE.MeshStandardMaterial({ color: new THREE.Color(hilt.color).multiplyScalar(0.55), roughness: 0.9 });
    for (const x of [0.08, hiltLen - 0.03]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.073 * thick, 0.013, 6, 16), wrap);
      ring.rotation.y = Math.PI / 2;
      ring.position.x = x;
      g.add(ring);
    }
  }

  // ---- shaft ----
  const sm = partMaterial(shaft);
  const s0 = hiltLen;
  const s1 = hiltLen + shaftLen;
  g.add(rod(s0, s1, (twig ? 0.05 : 0.058) * thick, (twig ? 0.032 : 0.046) * thick, sm, 10));
  if (twig) {
    // a stick: a couple of snapped-off side twigs
    for (const [x, a] of [[0.35, 0.7], [0.7, -0.8]] as const) {
      const nub = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.12, 6), sm);
      nub.position.set(s0 + shaftLen * x, 0.04 * Math.sign(a), 0);
      nub.rotation.z = a;
      g.add(nub);
    }
  }

  // ---- tip: a collar that holds the tip sockets, then the head ----
  const c0 = s1;
  const h0 = c0 + collarLen;
  if (tipMat) {
    const cm = partMaterial(tipMat);
    if (collarLen > 0) g.add(rod(c0, h0, 0.06 * thick, 0.064 * thick, cm, 12));
    let head: THREE.Mesh;
    switch (tipMat.family) {
      case 'wood':
        head = new THREE.Mesh(new THREE.SphereGeometry(0.075 * thick, 14, 10), cm);
        head.position.x = h0 + 0.075 * thick;
        break;
      case 'metal': {
        const geo = new THREE.ConeGeometry(0.06 * thick, headLen, 12);
        geo.rotateZ(-Math.PI / 2);
        head = new THREE.Mesh(geo, cm);
        head.position.x = h0 + headLen / 2;
        break;
      }
      case 'stone':
        head = new THREE.Mesh(new THREE.OctahedronGeometry(0.085 * thick, 0), cm);
        head.position.x = h0 + 0.085 * thick;
        head.scale.set(1.3, 0.9, 0.9);
        break;
      case 'bone': {
        const geo = new THREE.ConeGeometry(0.05 * thick, headLen * 1.1, 10);
        geo.rotateZ(-Math.PI / 2 + 0.25);
        head = new THREE.Mesh(geo, cm);
        head.position.set(h0 + headLen / 2, 0.02, 0);
        break;
      }
      case 'crystal':
        head = new THREE.Mesh(new THREE.OctahedronGeometry(0.07 * thick, 0), cm);
        head.scale.set(2.2, 0.9, 0.9);
        head.position.x = h0 + 0.1 * thick;
        break;
      default:
        head = new THREE.Mesh(new THREE.TorusKnotGeometry(0.045 * thick, 0.016 * thick, 48, 6, 2, 3), cm);
        head.position.x = h0 + 0.07 * thick;
        head.rotation.y = Math.PI / 2;
    }
    head.castShadow = true;
    g.add(head);
  } else {
    // no tip: the shaft just comes to a point
    const geo = new THREE.ConeGeometry(0.035 * thick, headLen, 8);
    geo.rotateZ(-Math.PI / 2);
    const point = new THREE.Mesh(geo, sm);
    point.position.x = h0 + headLen / 2;
    g.add(point);
  }

  // ---- sockets and crystals, zone by zone ----
  const spread = (from: number, to: number, count: number, k: number) => from + ((to - from) * (k + 0.5)) / count;
  const socketX = (i: number) => {
    if (i < z.hilt) return spread(0.12, hiltLen - 0.05, z.hilt, i);
    if (i < z.hilt + z.shaft) return spread(s0 + 0.03, s1 - 0.03, z.shaft, i - z.hilt);
    return spread(c0, h0, z.tip, i - z.hilt - z.shaft);
  };
  const radiusAt = (i: number) => (i < z.hilt ? 0.072 : i < z.hilt + z.shaft ? 0.052 : 0.064) * thick;
  const socketRing = new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 0.6, metalness: 0.4 });
  const gem = (color: string, size: number) =>
    new THREE.Mesh(
      new THREE.OctahedronGeometry(size, 0),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1 }),
    );
  const n = build.spine.length;
  for (let i = 0; i < n; i++) {
    const x = socketX(i);
    const y = radiusAt(i);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.028 * thick, 0.008, 6, 14), socketRing);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, y, 0);
    g.add(ring);
    const slot = build.spine[i];
    if (slot) {
      const c = crystal(slot.id);
      const q = slot.quality === 'flawless' ? 1.25 : slot.quality === 'bright' ? 1.1 : slot.quality === 'chipped' ? 0.8 : 1;
      const m = gem(c.color, 0.032 * thick * q);
      m.position.set(x, y + 0.02, 0);
      m.scale.y = 1.4;
      g.add(m);
    }
  }
  for (const [gapStr, slot] of Object.entries(build.flanks)) {
    const gap = Number(gapStr);
    if (gap >= n - 1) continue;
    const x = (socketX(gap) + socketX(gap + 1)) / 2;
    const prong = rod(-0.035, 0.035, 0.006, 0.006, socketRing);
    prong.rotation.y = Math.PI / 2;
    prong.position.set(x, 0, 0.065 * thick);
    g.add(prong);
    const m = gem(crystal(slot.id).color, 0.026 * thick);
    m.position.set(x, 0, 0.1 * thick);
    g.add(m);
  }

  const tip = new THREE.Vector3(length + 0.04, 0, 0);
  if (glowTex) {
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: shot.color, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(0.45 * thick);
    glow.position.copy(tip);
    g.add(glow);
  }
  return { group: g, length, tip };
}

export function makeGlowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const grad = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grad;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function disposeGroup(g: THREE.Object3D) {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}

/** The slowly turning wand on the bench. */
export class WandView {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 2.6, 0.1, 50);
  private holder = new THREE.Group();
  private model: WandModel | null = null;
  private glowTex = makeGlowTexture();
  private spin = 0;
  private visible = true;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene.add(new THREE.HemisphereLight('#fff4e0', '#3a2a20', 1.4));
    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(1, 2, 3);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#9ec8ff', 1.2);
    rim.position.set(-2, 1, -2);
    this.scene.add(rim);
    this.scene.add(this.holder);
    this.camera.position.set(0, 0.35, 2.4);
    this.camera.lookAt(0, 0, 0);
    new IntersectionObserver((e) => (this.visible = e[0]?.isIntersecting ?? true)).observe(canvas);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    const loop = () => {
      if (this.visible) {
        this.spin += 0.008;
        this.holder.rotation.x = this.spin;
        this.holder.rotation.y = Math.sin(this.spin * 0.6) * 0.18;
        this.renderer.render(this.scene, this.camera);
      }
      requestAnimationFrame(loop);
    };
    loop();
  }

  resize() {
    const w = this.canvas.clientWidth || 330;
    const h = this.canvas.clientHeight || 130;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.frame();
  }

  private frame() {
    if (!this.model) return;
    // fit the whole wand in view, a 10-socket archwand included
    const fitDist = (this.model.length * 0.62) / Math.tan((this.camera.fov * Math.PI) / 360) / this.camera.aspect;
    this.camera.position.set(0, 0.3, Math.max(1.3, fitDist * 0.95));
    this.camera.lookAt(0, 0, 0);
  }

  update(build: WandBuild, shot: Shot) {
    if (this.model) {
      this.holder.remove(this.model.group);
      disposeGroup(this.model.group);
    }
    this.model = buildWandModel(build, shot, this.glowTex);
    this.model.group.position.x = -this.model.length / 2;
    this.holder.add(this.model.group);
    this.frame();
  }
}
