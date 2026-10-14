import './style.css';
import { mountBench, renderBench, wireBench } from './bench';
import { renderSide, wireSide } from './side';
import { onChange, state } from './state';
import { World } from './world';
import { mountTutorial } from './tutorial';

const bench = document.getElementById('bench')!;
const side = document.getElementById('side')!;
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const labels = document.getElementById('labels')!;

const world = new World(canvas, labels);

let lastBuild = state.build;
let lastEnv = state.env;
mountBench(bench);

function render() {
  // keep the bench scroll position across re-renders
  const y = bench.scrollTop;
  renderBench(bench, state);
  bench.scrollTop = y;
  renderSide(side, state);
  world.syncDummies();
  if (state.build !== lastBuild) {
    lastBuild = state.build;
    world.onBuildChanged();
  }
  if (state.env !== lastEnv) {
    lastEnv = state.env;
    world.onEnvChanged();
  }
}

wireBench(bench);
wireSide(side, () => world.reset());
onChange(render);
render();
mountTutorial();
world.start();
// handy for poking at the lab from the browser console
(window as unknown as { lab: World }).lab = world;

// B toggles the bench so the range can fill the screen
window.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (e.key.toLowerCase() === 'b') {
    document.getElementById('app')!.classList.toggle('bench-hidden');
    window.setTimeout(() => world.resize(), 0);
  }
});
