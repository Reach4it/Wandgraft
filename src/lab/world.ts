// The firing range: an isometric 3D grove with the player and test dummies.
// The simulation runs on a flat 2D plane (u = across the screen, v = up the screen,
// h = height); toWorld() maps it into the 3D scene for drawing.
import * as THREE from 'three';
import { DUMMIES, DummyDef, ELEMENTS, ElementId, material } from '../engine/data';
import { Shot, damageMultiplier } from '../engine/resolve';
import { HEAT_COOLING_PER_SECOND, makeRng, rollOverload } from '../engine/overload';
import { emit, state } from './state';
import { logLine } from './side';
import { toast } from './toast';

// ---------- plane <-> world ----------
const RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const UP = new THREE.Vector3(-1, 0, -1).normalize();
const toWorld = (u: number, v: number, h = 0) =>
  new THREE.Vector3(RIGHT.x * u + UP.x * v, h, RIGHT.z * u + UP.z * v);
const toPlane = (p: THREE.Vector3) => ({ u: p.dot(RIGHT), v: p.dot(UP) });

const BOUNDS = { u: 21, v: 12 };
const PLAYER_START = { u: -13, v: 0 };
const DUMMY_SPOTS: Record<string, { u: number; v: number }> = {
  straw: { u: 5, v: 5.5 },
  'stone-sentinel': { u: 10.5, v: 7.5 },
  'iron-knight': { u: 15.5, v: 3.5 },
  wisp: { u: 15.5, v: -3.5 },
  treant: { u: 10.5, v: -7.5 },
  'ember-golem': { u: 5, v: -5.5 },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

// ---------- types ----------
interface Dummy {
  def: DummyDef;
  u: number;
  v: number;
  h: number;
  hp: number;
  shell: number;
  ward: number;
  lastHit: number;
  burnUntil: number;
  burnDps: number;
  soakedUntil: number;
  rootedUntil: number;
  phased: boolean;
  wobble: number;
  respawnAt: number;
  recent: { t: number; dmg: number }[];
  group: THREE.Group;
  wardMesh?: THREE.Mesh;
  label: HTMLElement;
}

interface Projectile {
  shot: Shot;
  u: number;
  v: number;
  h: number;
  du: number;
  dv: number;
  speed: number;
  power: number;
  pierce: number;
  bounces: number;
  bouncesUsed: number;
  homing: boolean;
  target: Dummy | null;
  lob: { fromU: number; fromV: number; toU: number; toV: number; t: number; dur: number } | null;
  hit: Set<Dummy>;
  life: number;
  radius: number;
  canSeed: boolean;
  mesh: THREE.Object3D;
  trailEvery: number;
  trailClock: number;
}

interface Particle {
  sprite: THREE.Sprite;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  grow: number;
}

interface Fx {
  obj: THREE.Object3D;
  life: number;
  maxLife: number;
  kind: 'ring' | 'line' | 'zone';
  zone?: { u: number; v: number; r: number; dps: number; shot: Shot; tick: number };
}

// ---------- world ----------
export class World {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private timer = new THREE.Timer();
  private time = 0;
  private player = { u: PLAYER_START.u, v: PLAYER_START.v, facing: 0, moving: false, hurt: 0 };
  private playerGroup = new THREE.Group();
  private wandTip = new THREE.Mesh();
  private aimLines = new THREE.Group();
  private dummies: Dummy[] = [];
  private projectiles: Projectile[] = [];
  private particles: Particle[] = [];
  private fx: Fx[] = [];
  private keys = new Set<string>();
  private mouse = { u: 0, v: 0, down: false, overCanvas: false };
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private glowTex: THREE.Texture;
  private cooldown = 0;
  private lowChargeWarned = 0;
  private rng = makeRng(Date.now() % 100000);
  private pending: { at: number; fn: () => void }[] = [];
  charge = 0;
  heat = 0;

  constructor(private canvas: HTMLCanvasElement, private labels: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
    this.camera.position.set(60, 62, 60);
    this.camera.lookAt(0, 0, 0);

    this.glowTex = makeGlowTexture();
    this.buildGrove();
    this.buildPlayer();
    this.scene.add(this.aimLines);
    this.syncDummies();
    this.charge = state.shot.stats.maxCharge;
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // ---------- scene ----------
  private buildGrove() {
    const s = this.scene;
    s.background = new THREE.Color('#1c2a26');
    s.fog = new THREE.Fog('#1c2a26', 90, 150);

    s.add(new THREE.HemisphereLight('#c9d8ff', '#3a3020', 0.9));
    const sun = new THREE.DirectionalLight('#ffe2b8', 2.1);
    sun.position.set(30, 50, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40;
    sun.shadow.bias = -0.0005;
    s.add(sun);

    // Outer forest floor
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ color: '#25352b', roughness: 1 }));
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.02;
    outer.receiveShadow = true;
    s.add(outer);

    // Range floor, aligned with the u/v axes
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(BOUNDS.u * 2, BOUNDS.v * 2),
      new THREE.MeshStandardMaterial({ map: makeFloorTexture(), roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.rotation.z = Math.PI / 4;
    floor.receiveShadow = true;
    s.add(floor);

    // Stone walls: tall on the far sides, low on the near sides so they never hide the action
    const stone = new THREE.MeshStandardMaterial({ color: '#6e6a62', roughness: 0.9 });
    const wall = (u: number, v: number, lenU: number, lenV: number, height: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(lenU, height, lenV), stone);
      const p = toWorld(u, v, height / 2);
      m.position.copy(p);
      m.rotation.y = Math.PI / 4;
      m.castShadow = true;
      m.receiveShadow = true;
      s.add(m);
    };
    wall(0, BOUNDS.v + 0.4, BOUNDS.u * 2 + 1.6, 0.8, 1.6);
    wall(BOUNDS.u + 0.4, 0, 0.8, BOUNDS.v * 2 + 1.6, 1.6);
    wall(0, -BOUNDS.v - 0.4, BOUNDS.u * 2 + 1.6, 0.8, 0.35);
    wall(-BOUNDS.u - 0.4, 0, 0.8, BOUNDS.v * 2 + 1.6, 0.35);

    // The grove: trees in a loose ring outside the walls
    const trunk = new THREE.MeshStandardMaterial({ color: '#4a3424', roughness: 1 });
    const leaves = [
      new THREE.MeshStandardMaterial({ color: '#2f5a3a', roughness: 1 }),
      new THREE.MeshStandardMaterial({ color: '#3b6b40', roughness: 1 }),
      new THREE.MeshStandardMaterial({ color: '#26493a', roughness: 1 }),
    ];
    const rng = makeRng(11);
    for (let i = 0; i < 70; i++) {
      const a = rng() * Math.PI * 2;
      const ru = BOUNDS.u + 4 + rng() * 14;
      const rv = BOUNDS.v + 4 + rng() * 12;
      const u = Math.cos(a) * ru;
      const v = Math.sin(a) * rv;
      // keep the near side (bottom of the screen) clear of tall trees
      if (v < -BOUNDS.v - 1 || u < -BOUNDS.u - 1) {
        if (rng() < 0.7) continue;
      }
      const g = new THREE.Group();
      const height = 3 + rng() * 4;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, height * 0.45, 6), trunk);
      t.position.y = height * 0.22;
      t.castShadow = true;
      g.add(t);
      for (let k = 0; k < 3; k++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(1.5 - k * 0.35 + rng() * 0.3, height * 0.42, 7), leaves[(i + k) % 3]);
        c.position.y = height * (0.42 + k * 0.17);
        c.castShadow = true;
        g.add(c);
      }
      g.position.copy(toWorld(u, v));
      g.rotation.y = rng() * Math.PI;
      s.add(g);
    }

    // Glowing mushrooms along the walls: small light for mood
    const shroom = new THREE.MeshStandardMaterial({ color: '#9fe0ff', emissive: '#4fb8ff', emissiveIntensity: 1.2 });
    for (let i = 0; i < 26; i++) {
      const side = i % 2 === 0;
      const u = side ? -BOUNDS.u + rng() * BOUNDS.u * 2 : BOUNDS.u + 0.9;
      const v = side ? BOUNDS.v + 0.9 : -BOUNDS.v + rng() * BOUNDS.v * 2;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.12 + rng() * 0.1, 8, 6), shroom);
      m.position.copy(toWorld(u, v, 0.1));
      s.add(m);
    }
  }

  private buildPlayer() {
    const g = this.playerGroup;
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 10), new THREE.MeshStandardMaterial({ color: '#3d4f7a', roughness: 0.8 }));
    robe.position.y = 0.8;
    robe.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), new THREE.MeshStandardMaterial({ color: '#e2c4a0' }));
    head.position.y = 1.75;
    head.castShadow = true;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.75, 10), new THREE.MeshStandardMaterial({ color: '#2b3a5c' }));
    hat.position.y = 2.15;
    hat.rotation.z = 0.12;
    hat.castShadow = true;
    const wand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.9, 6), new THREE.MeshStandardMaterial({ color: '#8a6440' }));
    wand.rotation.z = Math.PI / 2;
    wand.position.set(0.55, 1.15, 0);
    this.wandTip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: state.shot.color }));
    this.wandTip.position.set(1.0, 1.15, 0);
    const tipGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: state.shot.color, blending: THREE.AdditiveBlending, depthWrite: false }));
    tipGlow.scale.set(0.8, 0.8, 0.8);
    this.wandTip.add(tipGlow);
    g.add(robe, head, hat, wand, this.wandTip);
    g.position.copy(toWorld(this.player.u, this.player.v));
    this.scene.add(g);
  }

  private makeDummyMesh(d: DummyDef): { group: THREE.Group; ward?: THREE.Mesh } {
    const g = new THREE.Group();
    const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
    const add = (m: THREE.Mesh, y: number) => {
      m.position.y = y;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    let ward: THREE.Mesh | undefined;
    switch (d.id) {
      case 'straw': {
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6), mat('#6b4a2a')), 1.1);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.1, 10), mat(d.color)), 1.2);
        add(new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), mat('#e3d08f')), 2.05);
        const arms = add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), mat('#6b4a2a')), 1.55);
        arms.rotation.z = Math.PI / 2;
        break;
      }
      case 'stone-sentinel': {
        add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.0), mat('#7a7a80')), 0.4);
        add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 0.9), mat(d.color)), 1.25);
        add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.6), mat('#9a9aa0')), 1.98);
        add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.08), mat('#ffd28a', { emissive: '#ffb347', emissiveIntensity: 1.4 })), 2.0).position.x = 0.31;
        break;
      }
      case 'iron-knight': {
        add(new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.0, 6, 12), mat(d.color, { metalness: 0.85, roughness: 0.35 })), 1.1);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.5, 10), mat('#8890a0', { metalness: 0.9, roughness: 0.3 })), 2.05);
        ward = new THREE.Mesh(
          new THREE.SphereGeometry(1.25, 24, 16),
          new THREE.MeshBasicMaterial({ color: '#8fc8ff', transparent: true, opacity: 0.18, depthWrite: false }),
        );
        ward.position.y = 1.2;
        g.add(ward);
        break;
      }
      case 'wisp': {
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), new THREE.MeshBasicMaterial({ color: '#e8fbff' }));
        core.position.y = 0;
        g.add(core);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: '#9ae6ff', blending: THREE.AdditiveBlending, depthWrite: false }));
        glow.scale.set(2.4, 2.4, 2.4);
        g.add(glow);
        const cage = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), new THREE.MeshBasicMaterial({ color: '#c8f0ff', wireframe: true, transparent: true, opacity: 0.6 }));
        g.add(cage);
        break;
      }
      case 'treant': {
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 1.1, 10), mat('#5a3d26')), 0.55);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.06, 10), mat('#c7a77a')), 1.12);
        for (let k = 0; k < 5; k++) {
          const sprout = add(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 6), mat(d.color)), 1.4);
          sprout.position.x = Math.cos(k * 1.3) * 0.4;
          sprout.position.z = Math.sin(k * 1.3) * 0.4;
        }
        break;
      }
      case 'ember-golem': {
        add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.75, 0), mat('#3a2a26', { emissive: '#ff4a10', emissiveIntensity: 0.35 })), 0.75);
        add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), mat('#4a3028', { emissive: '#ff6a1f', emissiveIntensity: 0.5 })), 1.75);
        add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd04a' })), 1.85).position.x = 0.45;
        break;
      }
    }
    return { group: g, ward };
  }

  /** Add or remove dummies to match the sandbox toggles. */
  syncDummies() {
    for (const def of DUMMIES) {
      const want = state.sandbox.dummies[def.id];
      const have = this.dummies.find((d) => d.def.id === def.id);
      if (want && !have) {
        const spot = DUMMY_SPOTS[def.id];
        const { group, ward } = this.makeDummyMesh(def);
        group.position.copy(toWorld(spot.u, spot.v));
        group.rotation.y = Math.PI / 4 + Math.PI; // face the player
        this.scene.add(group);
        const label = document.createElement('div');
        label.className = 'dlabel';
        this.labels.appendChild(label);
        this.dummies.push({
          def, u: spot.u, v: spot.v, h: def.id === 'wisp' ? 1.5 : 0,
          hp: def.hp, shell: def.shell ?? 0, ward: def.ward ?? 0,
          lastHit: -99, burnUntil: 0, burnDps: 0, soakedUntil: 0, rootedUntil: 0,
          phased: false, wobble: 0, respawnAt: 0, recent: [], group, wardMesh: ward, label,
        });
      } else if (!want && have) {
        this.scene.remove(have.group);
        have.label.remove();
        this.dummies = this.dummies.filter((d) => d !== have);
      }
    }
  }

  reset() {
    for (const d of this.dummies) {
      d.hp = d.def.hp;
      d.shell = d.def.shell ?? 0;
      d.ward = d.def.ward ?? 0;
      d.burnUntil = d.soakedUntil = d.rootedUntil = 0;
      d.recent = [];
    }
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.projectiles = [];
    for (const f of this.fx) this.scene.remove(f.obj);
    this.fx = [];
    this.player.u = PLAYER_START.u;
    this.player.v = PLAYER_START.v;
    this.charge = state.shot.stats.maxCharge;
    this.heat = 0;
    state.stabilityLoss = 0;
    emit();
    toast('Range reset.');
  }

  /** Called when the wand changes. */
  onBuildChanged() {
    (this.wandTip.material as THREE.MeshBasicMaterial).color.set(state.shot.color);
    ((this.wandTip.children[0] as THREE.Sprite).material as THREE.SpriteMaterial).color.set(state.shot.color);
    // a different wand comes off the bench fully charged and cool
    this.charge = state.shot.stats.maxCharge;
    this.heat = 0;
  }

  // ---------- input ----------
  private bindInput() {
    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
    });
    const c = this.canvas;
    c.addEventListener('pointermove', (e) => this.updateMouse(e));
    c.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.updateMouse(e);
      this.mouse.down = true;
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointerup', () => (this.mouse.down = false));
    c.addEventListener('pointerleave', () => (this.mouse.overCanvas = false));
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private updateMouse(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.groundPlane, hit)) {
      const p = toPlane(hit);
      this.mouse.u = p.u;
      this.mouse.v = p.v;
      this.mouse.overCanvas = true;
    }
  }

  resize() {
    const parent = this.canvas.parentElement!;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / Math.max(1, h);
    // Fit the range's full width (42 units plus a margin) and at least 22 units of height
    const half = Math.max(11, 23 / aspect);
    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
  }

  // ---------- firing ----------
  private tryFire() {
    const shot = state.shot;
    const stats = shot.stats;
    if (!state.sandbox.infiniteCharge && this.charge < shot.drain) {
      if (this.time - this.lowChargeWarned > 1.5) {
        toast(`Not enough charge: this shot needs ${shot.drain}.`);
        this.lowChargeWarned = this.time;
      }
      return;
    }
    if (!state.sandbox.infiniteCharge) this.charge -= shot.drain;

    let powerMult = 1;
    let extraTag: ElementId | null = null;
    this.heat += shot.heat;
    const limit = stats.heatLimit - state.stabilityLoss;
    if (state.sandbox.overloads && this.heat > limit) {
      const o = rollOverload(this.heat - limit, this.rng, stats.parts.shaft.id);
      this.heat = limit * 0.5;
      toast(`${o.title} ${o.text}`, 'alert', 2600);
      logLine(`<b>Overload: ${esc(o.title)}</b> ${esc(o.text)}`, 'overload');
      if (o.kind === 'fizzle') {
        this.puff(this.player.u, this.player.v, 1.2, '#888888', 14);
        return;
      }
      if (o.kind === 'backlash') {
        this.player.hurt = 0.5;
        logLine(`Backlash hits you for <b>${Math.round(shot.powerEach * o.backlash)}</b>.`, 'overload');
      }
      if (o.kind === 'crack') {
        state.stabilityLoss += 1;
        emit();
      }
      if (o.kind === 'surge') {
        powerMult = 3;
        const pool: ElementId[] = ['fire', 'water', 'earth', 'wind'];
        extraTag = pool[Math.floor(this.rng() * 4)];
      }
      if (o.kind === 'fireBurst') {
        this.ring(this.player.u, this.player.v, 3.5, '#ff7a2b');
        for (const d of this.dummies) {
          if (Math.hypot(d.u - this.player.u, d.v - this.player.v) < 3.5) this.damage(d, shot, shot.powerEach, 'resin flare');
        }
      }
    }

    const volley = (mult: number, label: string) => {
      const s: Shot = extraTag && !shot.tags.includes(extraTag) ? { ...shot, tags: [...shot.tags, extraTag] } : shot;
      this.fireVolley(s, shot.powerEach * powerMult * mult, label);
    };
    volley(1, '');
    for (let e = 1; e <= shot.echoes; e++) {
      this.pending.push({ at: this.time + 0.5 * e, fn: () => volley(Math.pow(0.6, e), 'echo') });
    }
  }

  private fireVolley(shot: Shot, power: number, _label: string) {
    const aimU = this.mouse.u - this.player.u;
    const aimV = this.mouse.v - this.player.v;
    const base = Math.atan2(aimV, aimU);
    const n = shot.count;
    const spread = (shot.spreadDeg * Math.PI) / 180;
    const live = this.dummies.filter((d) => d.respawnAt === 0);
    const targets = [...live].sort(
      (a, b) => angleDiff(Math.atan2(a.v - this.player.v, a.u - this.player.u), base) - angleDiff(Math.atan2(b.v - this.player.v, b.u - this.player.u), base),
    );
    for (let i = 0; i < n; i++) {
      const a = n === 1 ? base : base - spread / 2 + (spread * i) / (n - 1);
      this.spawn(shot, a, power, targets.length ? targets[i % targets.length] : null);
    }
    for (let k = 0; k < shot.sideCopies; k++) {
      this.spawn({ ...shot, aoeRadius: 0, seeds: 0 }, base + (k === 0 ? -0.2 : 0.2), shot.sideCopyPower, null);
    }
  }

  private spawn(shot: Shot, angle: number, power: number, target: Dummy | null, from?: { u: number; v: number; h: number }, isSeed = false) {
    const startU = from?.u ?? this.player.u + Math.cos(angle) * 0.9;
    const startV = from?.v ?? this.player.v + Math.sin(angle) * 0.9;
    const startH = from?.h ?? 1.15;
    const radius = (isSeed ? 0.12 : 0.24) * shot.size;
    const mesh = this.projectileMesh(shot, radius);
    this.scene.add(mesh);
    let lob: Projectile['lob'] = null;
    if (shot.form === 'lob' && !isSeed) {
      const dist = Math.min(24, Math.hypot(this.mouse.u - startU, this.mouse.v - startV));
      const toU = startU + Math.cos(angle) * dist;
      const toV = startV + Math.sin(angle) * dist;
      lob = { fromU: startU, fromV: startV, toU, toV, t: 0, dur: Math.max(0.45, dist / (shot.speed * 0.6)) };
    }
    this.projectiles.push({
      shot,
      u: startU,
      v: startV,
      h: startH,
      du: Math.cos(angle),
      dv: Math.sin(angle),
      speed: isSeed ? shot.speed * 0.7 : shot.speed,
      power,
      pierce: isSeed ? 0 : shot.pierce,
      bounces: isSeed ? 0 : shot.bounces,
      bouncesUsed: 0,
      homing: shot.homing && !isSeed,
      target: shot.homing ? target : null,
      lob,
      hit: new Set(),
      life: isSeed ? 0.6 : 2.6,
      radius,
      canSeed: !isSeed,
      mesh,
      trailEvery: shot.form === 'stream' ? 0.012 : 0.025,
      trailClock: 0,
    });
  }

  private projectileMesh(shot: Shot, r: number): THREE.Object3D {
    const g = new THREE.Group();
    const color = new THREE.Color(shot.color);
    let core: THREE.Mesh;
    if (shot.form === 'shard' || shot.form === 'lob') core = new THREE.Mesh(new THREE.OctahedronGeometry(r * 1.3, 0), new THREE.MeshBasicMaterial({ color }));
    else if (shot.form === 'gust') core = new THREE.Mesh(new THREE.TorusGeometry(r * 1.2, r * 0.35, 6, 14), new THREE.MeshBasicMaterial({ color }));
    else core = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), new THREE.MeshBasicMaterial({ color: color.clone().lerp(new THREE.Color('#ffffff'), 0.45) }));
    g.add(core);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(r * 7);
    g.add(glow);
    return g;
  }

  // ---------- damage ----------
  private damage(d: Dummy, shot: Shot, power: number, via: string, crit = false) {
    if (d.respawnAt) return 0;
    const name = d.def.name;
    if (d.phased) {
      this.floatText(d, 'phased', 'muted');
      logLine(`${esc(shotName(shot))} passes through the <b>${esc(name)}</b>: it is phased out.`);
      return 0;
    }
    const mult = damageMultiplier(shot, d.def.category, d.def.immune ?? []);
    let amount = power * mult * (crit ? 2 : 1);
    const notes: string[] = [];
    if (mult !== 1) notes.push(`×${mult.toFixed(2)} vs ${d.def.category}`);
    if (crit) notes.push('critical');
    if (via) notes.push(via);
    const breaks = shot.tags.includes('earth') || shot.effects.includes('armorBreak');

    if (d.ward > 0) {
      if (shot.effects.includes('buffStrip')) {
        d.ward = 0;
        notes.push('ward stripped');
      } else {
        const wardHit = amount * (breaks ? 2 : 1);
        d.ward = Math.max(0, d.ward - wardHit);
        notes.push(`ward took ${Math.round(wardHit)}`);
        if (d.ward === 0) notes.push('ward broken');
        amount = 0;
      }
    }
    if (amount > 0 && d.shell > 0) {
      if (breaks) {
        const shellHit = amount * 1.5;
        d.shell = Math.max(0, d.shell - shellHit);
        notes.push(`shell took ${Math.round(shellHit)}`);
        amount = 0;
      } else {
        d.shell = Math.max(0, d.shell - amount * 0.75);
        notes.push(`shell absorbed ${Math.round(amount * 0.75)}`);
        amount *= 0.25;
      }
      if (d.shell === 0) notes.push('shell cracked');
    }
    d.hp -= amount;
    d.lastHit = this.time;
    d.wobble = 0.35;
    if (amount > 0) d.recent.push({ t: this.time, dmg: amount });
    if (shot.siphon > 0 && amount > 0) this.charge = Math.min(state.shot.stats.maxCharge, this.charge + amount * shot.siphon);

    // statuses
    if (shot.effects.includes('burn') && !(d.def.immune ?? []).includes('fire')) {
      d.burnUntil = this.time + 3;
      d.burnDps = Math.max(d.burnDps, power * 0.12);
    }
    if (shot.effects.includes('soak') || shot.tags.includes('water')) d.soakedUntil = this.time + 5;
    if (shot.effects.includes('root') || shot.effects.includes('slow')) d.rootedUntil = this.time + 2;

    this.floatText(d, amount > 0 ? String(Math.round(amount)) : mult === 0 ? 'immune' : 'blocked', crit ? 'crit' : amount > 0 ? '' : 'muted');
    logLine(
      `${esc(shotName(shot))} → <b>${esc(name)}</b> <span class="dmg">${Math.round(amount)}</span>${notes.length ? ` <small>${esc(notes.join(', '))}</small>` : ''}`,
    );
    if (d.hp <= 0) this.breakDummy(d);
    return amount;
  }

  private breakDummy(d: Dummy) {
    d.hp = 0;
    d.respawnAt = this.time + 1.4;
    this.puff(d.u, d.v, 1.4, d.def.color, 26);
    logLine(`<b>${esc(d.def.name)}</b> broke. It rebuilds in a moment.`, 'kill');
  }

  private impact(p: Projectile, d: Dummy | null, at: { u: number; v: number; h: number }) {
    const shot = p.shot;
    const crit = this.rng() < shot.critChance;
    let power = p.power;
    if (shot.effects.includes('bouncePower')) power *= 1 + 0.15 * p.bouncesUsed;
    if (d) this.damage(d, shot, power, p.bouncesUsed ? `after ${p.bouncesUsed} bounce${p.bouncesUsed > 1 ? 's' : ''}` : '', crit);
    this.burst(at.u, at.v, at.h, shot.color, 10);

    const others = (r: number) =>
      this.dummies.filter((o) => o !== d && !o.respawnAt && Math.hypot(o.u - at.u, o.v - at.v) < r);

    if (shot.aoeRadius > 0 || shot.effects.includes('aoe')) {
      const r = shot.aoeRadius || 2.4;
      this.ring(at.u, at.v, r, shot.color);
      for (const o of others(r)) this.damage(o, shot, power * 0.7, 'blast');
    }
    if (shot.effects.includes('chain') && d) {
      let from = d;
      const done = new Set<Dummy>([d]);
      for (let k = 0; k < 3; k++) {
        const next = this.dummies
          .filter((o) => !done.has(o) && !o.respawnAt && Math.hypot(o.u - from.u, o.v - from.v) < 10)
          .sort((a, b) => Number(b.soakedUntil > this.time) - Number(a.soakedUntil > this.time) || Math.hypot(a.u - from.u, a.v - from.v) - Math.hypot(b.u - from.u, b.v - from.v))[0];
        if (!next) break;
        this.lightning(from, next, shot.color);
        const soaked = next.soakedUntil > this.time;
        this.damage(next, shot, power * (soaked ? 0.8 : 0.5), soaked ? 'chain, soaked' : 'chain');
        done.add(next);
        from = next;
      }
    }
    if (shot.effects.includes('leap') && d) {
      const near = others(8).slice(0, 2);
      for (const o of near) {
        this.lightning(d, o, shot.color);
        this.damage(o, shot, power * 0.5, 'leap');
      }
    }
    if (shot.effects.includes('burnSpread') && d) {
      for (const o of others(3)) {
        o.burnUntil = this.time + 3;
        o.burnDps = Math.max(o.burnDps, power * 0.1);
      }
    }
    if (shot.lingerSeconds > 0 || shot.effects.includes('zone')) {
      this.zone(at.u, at.v, 2.2, shot.lingerSeconds || 3, power * 0.2, shot);
    }
    if (shot.effects.includes('blind') || shot.byproducts.length) this.puff(at.u, at.v, 1.6, '#d8dde0', 12);
    if (shot.seeds > 0 && p.canSeed) {
      for (let k = 0; k < shot.seeds; k++) {
        const a = (k / shot.seeds) * Math.PI * 2 + this.rng() * 0.4;
        const seedShot: Shot = { ...shot, aoeRadius: 0, seeds: 0, lingerSeconds: 0, effects: shot.effects.filter((e) => e !== 'aoe' && e !== 'zone' && e !== 'chain') };
        this.spawn(seedShot, a, power * 0.25, null, { u: at.u + Math.cos(a) * 0.9, v: at.v + Math.sin(a) * 0.9, h: 0.8 }, true);
      }
    }
  }

  // ---------- effects ----------
  private particle(u: number, v: number, h: number, color: string, vel: THREE.Vector3, life: number, size: number, grow = 0) {
    if (this.particles.length > 700) return;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sp.position.copy(toWorld(u, v, h));
    sp.scale.setScalar(size);
    this.scene.add(sp);
    this.particles.push({ sprite: sp, vel, life, maxLife: life, grow });
  }

  private burst(u: number, v: number, h: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const vel = new THREE.Vector3((this.rng() - 0.5) * 6, this.rng() * 4, (this.rng() - 0.5) * 6);
      this.particle(u, v, h, color, vel, 0.35 + this.rng() * 0.3, 0.5 + this.rng() * 0.4);
    }
  }

  private puff(u: number, v: number, r: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      const vel = new THREE.Vector3(Math.cos(a) * r, 0.6 + this.rng(), Math.sin(a) * r);
      this.particle(u, v, 0.6, color, vel, 0.8 + this.rng() * 0.5, 0.9, 1.5);
    }
  }

  private ring(u: number, v: number, r: number, color: string) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.copy(toWorld(u, v, 0.08));
    m.userData.r = r;
    this.scene.add(m);
    this.fx.push({ obj: m, life: 0.45, maxLife: 0.45, kind: 'ring' });
  }

  private lightning(a: Dummy, b: Dummy, color: string) {
    const pts: THREE.Vector3[] = [];
    const steps = 9;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const jitter = i === 0 || i === steps ? 0 : (this.rng() - 0.5) * 1.1;
      pts.push(toWorld(a.u + (b.u - a.u) * t + jitter, a.v + (b.v - a.v) * t - jitter, 1.3 + (this.rng() - 0.5) * 0.6));
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.5), transparent: true }));
    this.scene.add(line);
    this.fx.push({ obj: line, life: 0.3, maxLife: 0.3, kind: 'line' });
  }

  private zone(u: number, v: number, r: number, seconds: number, dps: number, shot: Shot) {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(r, 40),
      new THREE.MeshBasicMaterial({ color: shot.color, transparent: true, opacity: 0.32, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.copy(toWorld(u, v, 0.05));
    this.scene.add(m);
    this.fx.push({ obj: m, life: seconds, maxLife: seconds, kind: 'zone', zone: { u, v, r, dps, shot, tick: 0 } });
  }

  private floatText(d: Dummy, text: string, kind: string) {
    const p = toWorld(d.u, d.v, d.h + 2.6).project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    const el = document.createElement('span');
    el.className = `float ${kind}`;
    el.textContent = text;
    el.style.left = `${((p.x + 1) / 2) * r.width + (this.rng() - 0.5) * 30}px`;
    el.style.top = `${((1 - p.y) / 2) * r.height}px`;
    this.labels.appendChild(el);
    window.setTimeout(() => el.remove(), 1000);
  }

  // ---------- loop ----------
  start() {
    const tick = (now?: number) => {
      this.timer.update(now);
      const raw = Math.min(0.05, this.timer.getDelta());
      const dt = raw * state.sandbox.timeScale;
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(tick);
    };
    tick();
  }

  private update(dt: number) {
    this.time += dt;
    const shot = state.shot;
    const stats = shot.stats;

    // movement (screen-relative: W is up the screen)
    let mu = 0;
    let mv = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) mv += 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) mv -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) mu += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) mu -= 1;
    this.player.moving = mu !== 0 || mv !== 0;
    if (this.player.moving) {
      const len = Math.hypot(mu, mv);
      this.player.u = clamp(this.player.u + (mu / len) * 7 * dt, -BOUNDS.u + 0.8, BOUNDS.u - 0.8);
      this.player.v = clamp(this.player.v + (mv / len) * 7 * dt, -BOUNDS.v + 0.8, BOUNDS.v - 0.8);
    }
    if (this.mouse.overCanvas) this.player.facing = Math.atan2(this.mouse.v - this.player.v, this.mouse.u - this.player.u);
    this.playerGroup.position.copy(toWorld(this.player.u, this.player.v));
    this.playerGroup.rotation.y = Math.PI / 4 + this.player.facing;
    this.player.hurt = Math.max(0, this.player.hurt - dt);
    this.playerGroup.position.y = this.player.hurt > 0 ? Math.sin(this.time * 60) * 0.05 : 0;

    // charge and heat
    let rechargeMult = shot.rechargeMult;
    if (stats.parts.grip.id === 'basalt') rechargeMult *= this.player.moving ? 0 : 1.5;
    this.charge = Math.min(stats.maxCharge, this.charge + stats.chargePerSecond * rechargeMult * dt);
    this.heat = Math.max(0, this.heat - HEAT_COOLING_PER_SECOND * dt);

    // firing
    this.cooldown -= dt;
    if (this.mouse.down && this.cooldown <= 0) {
      this.tryFire();
      this.cooldown = 0.42 / stats.tempo;
    }
    for (const job of this.pending.filter((j) => j.at <= this.time)) job.fn();
    this.pending = this.pending.filter((j) => j.at > this.time);

    this.updateProjectiles(dt);
    this.updateDummies(dt);
    this.updateFx(dt);
    this.updateAim();
    this.updateLabels();
    this.updateHud();
  }

  private updateProjectiles(dt: number) {
    const keep: Projectile[] = [];
    for (const p of this.projectiles) {
      let alive = true;
      p.life -= dt;
      if (p.lob) {
        const L = p.lob;
        L.t += dt / L.dur;
        const t = Math.min(1, L.t);
        p.u = L.fromU + (L.toU - L.fromU) * t;
        p.v = L.fromV + (L.toV - L.fromV) * t;
        p.h = 1.15 + Math.sin(Math.PI * t) * 4.5 - 1.15 * t;
        if (t >= 1) {
          const hitD = this.dummies.find((d) => !d.respawnAt && Math.hypot(d.u - p.u, d.v - p.v) < 1.6);
          this.impact(p, hitD ?? null, { u: p.u, v: p.v, h: 0.2 });
          if (!hitD && !(p.shot.aoeRadius > 0 || p.shot.effects.includes('aoe'))) {
            this.ring(p.u, p.v, 1.2, p.shot.color);
          }
          alive = false;
        }
      } else {
        if (p.homing && p.target && !p.target.respawnAt) {
          const want = Math.atan2(p.target.v - p.v, p.target.u - p.u);
          const cur = Math.atan2(p.dv, p.du);
          let diff = want - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turn = clamp(diff, -5 * dt, 5 * dt);
          p.du = Math.cos(cur + turn);
          p.dv = Math.sin(cur + turn);
        }
        p.u += p.du * p.speed * dt;
        p.v += p.dv * p.speed * dt;
        if (p.target?.def.id === 'wisp' || p.homing) {
          const goal = p.target ? p.target.h + 1 : 1.15;
          p.h += (goal - p.h) * Math.min(1, dt * 3);
        }

        // walls
        const outU = Math.abs(p.u) > BOUNDS.u;
        const outV = Math.abs(p.v) > BOUNDS.v;
        if (outU || outV) {
          if (p.bounces > 0) {
            p.bounces--;
            p.bouncesUsed++;
            if (outU) p.du = -p.du;
            if (outV) p.dv = -p.dv;
            p.u = clamp(p.u, -BOUNDS.u, BOUNDS.u);
            p.v = clamp(p.v, -BOUNDS.v, BOUNDS.v);
            this.burst(p.u, p.v, p.h, p.shot.color, 5);
          } else {
            this.burst(p.u, p.v, p.h, p.shot.color, 6);
            alive = false;
          }
        }

        // dummies
        if (alive) {
          for (const d of this.dummies) {
            if (d.respawnAt || p.hit.has(d)) continue;
            if (Math.hypot(d.u - p.u, d.v - p.v) < 0.75 + p.radius) {
              p.hit.add(d);
              this.impact(p, d, { u: p.u, v: p.v, h: p.h });
              if (p.pierce > 0) {
                p.pierce--;
              } else {
                alive = false;
                break;
              }
            }
          }
        }
        if (p.life <= 0) alive = false;
      }

      p.mesh.position.copy(toWorld(p.u, p.v, p.h));
      p.mesh.rotation.y += dt * 8;
      p.trailClock += dt;
      if (p.trailClock > p.trailEvery) {
        p.trailClock = 0;
        this.particle(p.u, p.v, p.h, p.shot.color, new THREE.Vector3(0, 0.3, 0), 0.28, p.radius * 4.5);
      }
      if (alive) keep.push(p);
      else this.scene.remove(p.mesh);
    }
    this.projectiles = keep;
  }

  private updateDummies(dt: number) {
    for (const d of this.dummies) {
      if (d.respawnAt) {
        d.group.visible = false;
        if (this.time >= d.respawnAt) {
          d.respawnAt = 0;
          d.hp = d.def.hp;
          d.shell = d.def.shell ?? 0;
          d.ward = d.def.ward ?? 0;
          d.burnUntil = 0;
          d.group.visible = true;
        }
        continue;
      }
      // burning
      if (d.burnUntil > this.time) {
        d.hp -= d.burnDps * dt;
        d.recent.push({ t: this.time, dmg: d.burnDps * dt });
        if (this.rng() < dt * 14) this.particle(d.u + (this.rng() - 0.5), d.v + (this.rng() - 0.5), d.h + 0.6 + this.rng() * 1.2, '#ff7a2b', new THREE.Vector3(0, 1.6, 0), 0.5, 0.6);
        if (d.hp <= 0) this.breakDummy(d);
      } else d.burnDps = 0;
      // regrowth
      if (d.def.regen && d.burnUntil <= this.time && d.hp < d.def.hp) d.hp = Math.min(d.def.hp, d.hp + d.def.regen * dt);
      // shell and ward regrow when left alone
      if (d.def.shell && d.shell < d.def.shell && this.time - d.lastHit > 8) d.shell = Math.min(d.def.shell, d.shell + 40 * dt);
      if (d.def.ward && d.ward < d.def.ward && this.time - d.lastHit > 6) d.ward = Math.min(d.def.ward, d.ward + 50 * dt);
      if (d.wardMesh) {
        d.wardMesh.visible = d.ward > 0;
        (d.wardMesh.material as THREE.MeshBasicMaterial).opacity = 0.08 + 0.18 * (d.ward / (d.def.ward ?? 1));
      }
      // the wisp floats and phases
      if (d.def.id === 'wisp') {
        d.h = 1.5 + Math.sin(this.time * 1.7) * 0.35;
        d.phased = this.time % 4 > 2.5;
        d.group.children.forEach((c) => {
          const m = (c as THREE.Mesh).material as THREE.Material & { opacity?: number };
          m.transparent = true;
          m.opacity = d.phased ? 0.15 : c instanceof THREE.Mesh && (c.material as THREE.MeshBasicMaterial).wireframe ? 0.6 : 1;
        });
      }
      d.wobble = Math.max(0, d.wobble - dt);
      d.group.position.copy(toWorld(d.u, d.v, d.h));
      d.group.rotation.z = Math.sin(d.wobble * 40) * d.wobble * 0.4;
      d.recent = d.recent.filter((r) => this.time - r.t < 4);
    }
  }

  private updateFx(dt: number) {
    const keepP: Particle[] = [];
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.sprite);
        p.sprite.material.dispose();
        continue;
      }
      p.sprite.position.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(1 - dt * 2.5);
      const k = p.life / p.maxLife;
      p.sprite.material.opacity = k;
      if (p.grow) p.sprite.scale.multiplyScalar(1 + p.grow * dt);
      keepP.push(p);
    }
    this.particles = keepP;

    const keepF: Fx[] = [];
    for (const f of this.fx) {
      f.life -= dt;
      const k = Math.max(0, f.life / f.maxLife);
      const mat = (f.obj as THREE.Mesh).material as THREE.Material & { opacity: number };
      if (f.kind === 'ring') {
        const s = (f.obj.userData.r as number) * (1 - k * 0.7);
        f.obj.scale.set(s, s, s);
        mat.opacity = k;
      } else if (f.kind === 'line') {
        mat.opacity = k;
      } else if (f.kind === 'zone' && f.zone) {
        mat.opacity = 0.18 + 0.14 * Math.sin(this.time * 6) * k + 0.1 * k;
        f.zone.tick -= dt;
        if (f.zone.tick <= 0) {
          f.zone.tick = 0.5;
          for (const d of this.dummies) {
            if (!d.respawnAt && Math.hypot(d.u - f.zone.u, d.v - f.zone.v) < f.zone.r) this.damage(d, f.zone.shot, f.zone.dps * 0.5, 'zone');
          }
        }
        if (this.rng() < dt * 10) this.particle(f.zone.u + (this.rng() - 0.5) * f.zone.r, f.zone.v + (this.rng() - 0.5) * f.zone.r, 0.2, f.zone.shot.color, new THREE.Vector3(0, 1, 0), 0.6, 0.5);
      }
      if (f.life <= 0) this.scene.remove(f.obj);
      else keepF.push(f);
    }
    this.fx = keepF;
  }

  /** Ground preview of where the next shot goes. */
  private updateAim() {
    this.aimLines.clear();
    if (!this.mouse.overCanvas) return;
    const shot = state.shot;
    const base = Math.atan2(this.mouse.v - this.player.v, this.mouse.u - this.player.u);
    const n = Math.min(shot.count, 7);
    const spread = (shot.spreadDeg * Math.PI) / 180;
    const len = shot.form === 'lob' ? Math.min(24, Math.hypot(this.mouse.u - this.player.u, this.mouse.v - this.player.v)) : Math.min(26, shot.speed * 1.4);
    const mat = new THREE.LineDashedMaterial({ color: shot.color, dashSize: 0.5, gapSize: 0.35, transparent: true, opacity: 0.55 });
    for (let i = 0; i < n; i++) {
      const a = n === 1 ? base : base - spread / 2 + (spread * i) / (n - 1);
      const pts: THREE.Vector3[] = [];
      const steps = shot.form === 'lob' ? 16 : 1;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const h = shot.form === 'lob' ? 0.1 + Math.sin(Math.PI * t) * 3 : 0.08;
        pts.push(toWorld(this.player.u + Math.cos(a) * (0.9 + len * t), this.player.v + Math.sin(a) * (0.9 + len * t), h));
      }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
      line.computeLineDistances();
      this.aimLines.add(line);
    }
    if (shot.aoeRadius > 0 && shot.form === 'lob') {
      const ring = new THREE.Mesh(new THREE.RingGeometry(shot.aoeRadius - 0.08, shot.aoeRadius, 40), new THREE.MeshBasicMaterial({ color: shot.color, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(toWorld(this.player.u + Math.cos(base) * (0.9 + len), this.player.v + Math.sin(base) * (0.9 + len), 0.06));
      this.aimLines.add(ring);
    }
  }

  private updateLabels() {
    const r = this.canvas.getBoundingClientRect();
    for (const d of this.dummies) {
      const p = toWorld(d.u, d.v, d.h + (d.def.id === 'wisp' ? 1.2 : 2.7)).project(this.camera);
      d.label.style.transform = `translate(${((p.x + 1) / 2) * r.width}px, ${((1 - p.y) / 2) * r.height}px) translate(-50%, -100%)`;
      d.label.style.display = d.respawnAt ? 'none' : '';
      const dps = d.recent.reduce((s, x) => s + x.dmg, 0) / 4;
      const status: string[] = [];
      if (d.burnUntil > this.time) status.push('Burning');
      if (d.soakedUntil > this.time) status.push('Soaked');
      if (d.rootedUntil > this.time) status.push('Rooted');
      if (d.phased) status.push('Phased');
      const bar = (cls: string, v: number, max: number) => `<div class="hb ${cls}"><i style="width:${Math.max(0, (v / max) * 100)}%"></i></div>`;
      d.label.innerHTML = `<b>${esc(d.def.name)}</b>
        ${d.def.ward ? bar('ward', d.ward, d.def.ward) : ''}
        ${d.def.shell ? bar('shell', d.shell, d.def.shell) : ''}
        ${bar('hp', d.hp, d.def.hp)}
        <span class="dps">${dps >= 1 ? `${Math.round(dps)} per second` : ''}${status.length ? ` ${status.join(', ')}` : ''}</span>`;
    }
  }

  private updateHud() {
    const st = state.shot.stats;
    const limit = st.heatLimit - state.stabilityLoss;
    const cm = document.getElementById('charge-meter');
    const hm = document.getElementById('heat-meter');
    if (cm) {
      const k = state.sandbox.infiniteCharge ? 1 : this.charge / st.maxCharge;
      (cm.querySelector('.bar i') as HTMLElement).style.width = `${k * 100}%`;
      cm.querySelector('.meter-value')!.textContent = state.sandbox.infiniteCharge ? 'infinite' : `${Math.floor(this.charge)} / ${st.maxCharge}`;
      cm.classList.toggle('low', !state.sandbox.infiniteCharge && this.charge < state.shot.drain);
    }
    if (hm) {
      const scaleMax = Math.max(limit * 1.5, 1);
      (hm.querySelector('.bar i') as HTMLElement).style.width = `${Math.min(1, this.heat / scaleMax) * 100}%`;
      (hm.querySelector('.limit') as HTMLElement).style.left = `${(limit / scaleMax) * 100}%`;
      hm.querySelector('.meter-value')!.textContent = `${this.heat.toFixed(1)} / ${limit}`;
      hm.classList.toggle('hot', this.heat > limit * 0.75);
    }
  }
}

// ---------- helpers ----------
function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}

function angleDiff(a: number, b: number) {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

function shotName(shot: Shot) {
  if (shot.reaction) return shot.reaction.name;
  if (shot.tags.length) return shot.tags.map((t) => ELEMENTS[t].name).join(' + ');
  return 'Arcane bolt';
}

function makeGlowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeFloorTexture(): THREE.Texture {
  const W = 840;
  const H = 480;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#3f5a3c';
  g.fillRect(0, 0, W, H);
  const rng = makeRng(5);
  for (let i = 0; i < 9000; i++) {
    const shade = 40 + Math.floor(rng() * 40);
    g.fillStyle = `rgba(${shade + 10},${shade + 50},${shade + 10},${0.12 + rng() * 0.2})`;
    g.fillRect(rng() * W, rng() * H, 2 + rng() * 3, 2 + rng() * 6);
  }
  // worn practice path from the player's end to the dummies
  const grad = g.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, 'rgba(150,120,80,0.35)');
  grad.addColorStop(1, 'rgba(150,120,80,0.05)');
  g.fillStyle = grad;
  g.fillRect(0, H * 0.38, W, H * 0.24);
  // faint distance lines every 5 units, so ranges are readable
  g.strokeStyle = 'rgba(230,220,180,0.13)';
  g.lineWidth = 2;
  for (let u = 5; u < 42; u += 5) {
    const x = (u / 42) * W;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, H);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// referenced for its side effect of validating the data at startup
void material;
