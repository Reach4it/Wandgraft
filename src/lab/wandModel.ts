// A 3D model of the built wand: grip, shaft with its socketed crystals, and cap.
// Used for the bench's wand view and for the wand in the player's hand.
// The wand lies along +X: the handle end at x = 0, the tip at x = length.
import * as THREE from 'three';
import { Material, crystal } from '../engine/data';
import { Shot } from '../engine/resolve';
import { WandBuild, fittedParts } from '../engine/wand';

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
  const { f, grip, shaft, cap } = fittedParts(build);
  const g = new THREE.Group();
  const staff = f.id === 'staff';
  const twig = f.id === 'twig';
  const gripLen = grip ? (staff ? 0.5 : 0.3) : 0;
  const shaftLen = staff ? 1.45 : twig ? 1.0 : 0.85;
  const capLen = cap ? (staff ? 0.3 : 0.2) : 0.08;
  const length = gripLen + shaftLen + capLen;
  const thick = staff ? 1.35 : 1;

  // ---- grip: wrapped handle with a pommel ----
  if (grip) {
    const gm = partMaterial(grip);
    g.add(rod(0, gripLen, 0.072 * thick, 0.068 * thick, gm, 12));
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.085 * thick, 14, 10), gm);
    pommel.position.x = 0;
    pommel.castShadow = true;
    g.add(pommel);
    const wrap = new THREE.MeshStandardMaterial({ color: new THREE.Color(grip.color).multiplyScalar(0.55), roughness: 0.9 });
    for (let k = 1; k <= 4; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.073 * thick, 0.012, 6, 16), wrap);
      ring.rotation.y = Math.PI / 2;
      ring.position.x = (gripLen * k) / 5;
      g.add(ring);
    }
  }

  // ---- shaft ----
  const sm = partMaterial(shaft);
  const s0 = gripLen;
  const s1 = gripLen + shaftLen;
  g.add(rod(s0, s1, (twig ? 0.05 : 0.058) * thick, (twig ? 0.032 : 0.044) * thick, sm, 10));
  if (twig) {
    // a stick: a couple of snapped-off side twigs
    for (const [x, a] of [[0.35, 0.7], [0.7, -0.8]] as const) {
      const nub = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.12, 6), sm);
      nub.position.set(s0 + shaftLen * x, 0.04 * Math.sign(a), 0);
      nub.rotation.z = a;
      g.add(nub);
    }
  }

  // ---- sockets and crystals ----
  const n = build.spine.length;
  const socketRing = new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 0.6, metalness: 0.4 });
  const socketX = (i: number) => s0 + shaftLen * ((i + 0.5) / n) * 0.9 + shaftLen * 0.05;
  const gem = (color: string, size: number) =>
    new THREE.Mesh(
      new THREE.OctahedronGeometry(size, 0),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1 }),
    );
  for (let i = 0; i < n; i++) {
    const x = socketX(i);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03 * thick, 0.009, 6, 14), socketRing);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 0.05 * thick, 0);
    g.add(ring);
    const slot = build.spine[i];
    if (slot) {
      const c = crystal(slot.id);
      const q = slot.quality === 'flawless' ? 1.25 : slot.quality === 'bright' ? 1.1 : slot.quality === 'chipped' ? 0.8 : 1;
      const m = gem(c.color, 0.034 * thick * q);
      m.position.set(x, 0.07 * thick, 0);
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

  // ---- cap ----
  const c0 = s1;
  if (cap) {
    const cm = partMaterial(cap);
    let head: THREE.Mesh;
    switch (cap.family) {
      case 'wood':
        head = new THREE.Mesh(new THREE.SphereGeometry(0.075 * thick, 14, 10), cm);
        head.position.x = c0 + 0.08 * thick;
        break;
      case 'metal': {
        const geo = new THREE.ConeGeometry(0.06 * thick, capLen, 12);
        geo.rotateZ(-Math.PI / 2);
        head = new THREE.Mesh(geo, cm);
        head.position.x = c0 + capLen / 2;
        g.add(rod(c0 - 0.02, c0 + 0.02, 0.062 * thick, 0.062 * thick, cm));
        break;
      }
      case 'stone': {
        head = new THREE.Mesh(new THREE.OctahedronGeometry(0.085 * thick, 0), cm);
        head.position.x = c0 + 0.09 * thick;
        head.scale.set(1.3, 0.9, 0.9);
        break;
      }
      case 'bone': {
        const geo = new THREE.ConeGeometry(0.05 * thick, capLen * 1.1, 10);
        geo.rotateZ(-Math.PI / 2 + 0.25);
        head = new THREE.Mesh(geo, cm);
        head.position.set(c0 + capLen / 2, 0.02, 0);
        break;
      }
      case 'crystal': {
        head = new THREE.Mesh(new THREE.OctahedronGeometry(0.07 * thick, 0), cm);
        head.scale.set(2.2, 0.9, 0.9);
        head.position.x = c0 + 0.12 * thick;
        break;
      }
      default: {
        head = new THREE.Mesh(new THREE.TorusKnotGeometry(0.045 * thick, 0.016 * thick, 48, 6, 2, 3), cm);
        head.position.x = c0 + 0.07 * thick;
        head.rotation.y = Math.PI / 2;
      }
    }
    head.castShadow = true;
    g.add(head);
  } else {
    // no cap: the shaft just comes to a point
    const geo = new THREE.ConeGeometry(0.035 * thick, capLen, 8);
    geo.rotateZ(-Math.PI / 2);
    const point = new THREE.Mesh(geo, sm);
    point.position.x = c0 + capLen / 2;
    g.add(point);
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
    // fit the whole wand in view, a staff included
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
