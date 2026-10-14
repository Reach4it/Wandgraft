// The guided tutorial: short lessons from a bare twig to side slots. Each lesson has one goal
// that the lab checks live, from the wand on the bench or from what happens on the range.
import { crystal } from '../engine/data';
import { zoneRange } from '../engine/wand';
import { LabEvent, LabState, onChange, onLabEvent, setBuild, state } from './state';
import { emptyBuild } from '../engine/wand';
import { toast } from './toast';

interface Lesson {
  title: string;
  text: string;
  /** Checked whenever the wand changes. */
  check?: (s: LabState, memo: Memo) => boolean;
  /** Checked on range events. */
  onEvent?: (e: LabEvent) => boolean;
  /** Runs when the lesson starts. */
  enter?: (s: LabState, memo: Memo) => void;
}

interface Memo {
  reaction?: string | null;
}

const zoneHas = (s: LabState, zone: 'hilt' | 'shaft' | 'tip', ok: (id: string) => boolean) => {
  const [a, b] = zoneRange(s.shot.stats, zone);
  return s.build.spine.slice(a, b).some((c) => !!c && ok(c.id));
};

const LESSONS: Lesson[] = [
  {
    title: 'Your first crystal',
    text: 'You hold a bare Chalk twig: a shaft with 2 sockets and nothing else. Drag a Fire crystal from Crystals (bench, bottom) into one of its sockets.',
    check: (s) => s.build.spine.some((c) => c?.id === 'fire'),
  },
  {
    title: 'Fire!',
    text: 'Aim at the Straw Dummy on the range and hold the left mouse button. Watch the damage log on this panel.',
    onEvent: (e) => e.type === 'hit' && e.dummy === 'straw' && e.amount > 0,
  },
  {
    title: 'Two elements fuse',
    text: 'Drag Water into the other socket. Two elements side by side fuse into a new spell. The bench shows its name.',
    check: (s) => s.shot.reactions.length > 0,
  },
  {
    title: 'Order matters',
    text: 'Drag one crystal onto the other to swap them. The first is the core and the second the coat, so swapping them changes the spell.',
    enter: (s, memo) => (memo.reaction = s.shot.reaction?.id ?? null),
    check: (s, memo) => !!s.shot.reaction && s.shot.reaction.id !== memo.reaction,
  },
  {
    title: 'Grow a hilt',
    text: 'Pick Wand at the top of the bench. Then drag any material from Parts onto the dashed hilt.',
    check: (s) => s.shot.stats.form.id !== 'twig' && !!s.shot.stats.parts.hilt,
  },
  {
    title: 'The hilt sets the base',
    text: 'Drag an element crystal into the hilt socket. An element in the hilt is the base of the spell and hits 20% harder.',
    check: (s) => zoneHas(s, 'hilt', (id) => crystal(id).kind === 'element'),
  },
  {
    title: 'Add a tip',
    text: 'Pick Grafted wand, drag a material onto the tip, then drop Nova Pearl (under Size) in the tip socket. Impact crystals work harder in the tip.',
    check: (s) => zoneHas(s, 'tip', (id) => id === 'nova'),
  },
  {
    title: 'Crack the shell',
    text: 'Earth breaks armor. Put Earth in your wand and hit the Stone Sentinel until its grey shell bar is gone.',
    onEvent: (e) => e.type === 'shell' && e.dummy === 'stone-sentinel',
  },
  {
    title: 'Pick the right element',
    text: 'The Ember Golem shrugs off Fire. Break it with Water.',
    onEvent: (e) => e.type === 'break' && e.dummy === 'ember-golem',
  },
  {
    title: 'Push your luck',
    text: 'Every crystal adds Heat. Fire fast until the Heat bar passes its white line and the wand overloads. Sometimes you get a Wild surge.',
    onEvent: (e) => e.type === 'overload',
  },
  {
    title: 'Side slots',
    text: 'Pick Master wand with a Hollowreed or Copper shaft. Put two elements next to each other, then drop a Catalyst in the diamond side slot above them.',
    check: (s) => Object.values(s.build.flanks).some((c) => c.id === 'catalyst'),
  },
];

const KEY = 'wandgraft.tutorial.v1';
const DONE = LESSONS.length;

let step = 0;
let memo: Memo = {};
let hidden = false;
let advancing = false;

function load() {
  try {
    step = Math.min(DONE, Math.max(0, Number(localStorage.getItem(KEY) ?? '0') || 0));
    hidden = localStorage.getItem(`${KEY}.hidden`) === '1';
  } catch {
    step = 0;
  }
}

function save() {
  try {
    localStorage.setItem(KEY, String(step));
    localStorage.setItem(`${KEY}.hidden`, hidden ? '1' : '0');
  } catch {
    /* the tutorial still works, it just won't remember */
  }
}

function go(to: number) {
  step = Math.min(DONE, Math.max(0, to));
  memo = {};
  LESSONS[step]?.enter?.(state, memo);
  save();
  render();
}

function complete() {
  if (advancing) return;
  advancing = true;
  toast(`Lesson done: ${LESSONS[step].title}.`);
  render(true);
  window.setTimeout(() => {
    advancing = false;
    go(step + 1);
  }, 900);
}

function render(justDone = false) {
  const root = document.getElementById('tutorial');
  if (!root) return;
  if (hidden) {
    root.innerHTML = `<button class="ghost small" data-tut="show">Show the tutorial</button>`;
    return;
  }
  const dots = LESSONS.map((_, i) => `<span class="dot ${i < step ? 'done' : i === step ? 'now' : ''}"></span>`).join('');
  if (step >= DONE) {
    root.innerHTML = `
      <div class="tut">
        <div class="tut-head"><h2 class="block-title">Tutorial complete</h2><div class="dots">${dots}</div></div>
        <p>You know the basics. Load a sample build from the bench, or try to fill all 10 sockets of an Archwand.</p>
        <div class="tut-actions"><button class="ghost small" data-tut="restart">Start over</button><button class="ghost small" data-tut="hide">Hide</button></div>
      </div>`;
    return;
  }
  const l = LESSONS[step];
  root.innerHTML = `
    <div class="tut ${justDone ? 'is-done' : ''}">
      <div class="tut-head"><h2 class="block-title">Lesson ${step + 1} of ${DONE}</h2><div class="dots" aria-hidden="true">${dots}</div></div>
      <h3>${justDone ? '✓ ' : ''}${l.title}</h3>
      <p>${l.text}</p>
      <div class="tut-actions">
        <button class="ghost small" data-tut="back" ${step === 0 ? 'disabled' : ''}>Back</button>
        <button class="ghost small" data-tut="skip">Skip</button>
        <button class="ghost small" data-tut="hide">Hide</button>
      </div>
    </div>`;
}

export function mountTutorial() {
  load();
  memo = {};
  LESSONS[step]?.enter?.(state, memo);
  render();

  onChange((s) => {
    const l = LESSONS[step];
    if (l?.check && !advancing && l.check(s, memo)) complete();
  });
  onLabEvent((e) => {
    const l = LESSONS[step];
    if (l?.onEvent && !advancing && l.onEvent(e)) complete();
  });

  document.getElementById('tutorial')?.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tut]');
    if (!b) return;
    const act = b.dataset.tut;
    if (act === 'back') go(step - 1);
    else if (act === 'skip') go(step + 1);
    else if (act === 'hide') {
      hidden = true;
      save();
      render();
    } else if (act === 'show') {
      hidden = false;
      save();
      render();
    } else if (act === 'restart') {
      setBuild(emptyBuild('twig', null, 'chalk', null));
      go(0);
    }
  });
}
