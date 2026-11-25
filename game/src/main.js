// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between four screens: title, play, paused and shift over.
//
// ?seed=N fixes the orders and the shift. ?shot=start|play|serve|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady for
// a screenshot.
import { BEST_KEY, SEATS, STATIONS, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createAudio } from './audio.js';
import {
  ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_SERVE, ACTION_TOSS, createInput,
} from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best total then lasts this visit only.
  }
}

/** Map a click in logical coordinates onto a station action, a serve, or a walk target. */
function handleClick(point) {
  const state = world.state;
  // Customers first: a click on a seated customer serves them.
  for (const c of state.customers) {
    if (c.state !== 'waiting') continue;
    const seat = SEATS[c.seat];
    if (Math.abs(point.x - seat.x) < 70 && point.y > 150 && point.y < 320) {
      world.serveSeat(c.seat);
      return;
    }
  }
  // Stations: the click's sub-part (ladle, bin, basket) decides the action.
  for (const s of STATIONS) {
    if (point.y < 380 || point.y > 540 || point.x < s.x || point.x >= s.x + s.width) continue;
    const cx = s.x + s.width / 2;
    if (s.id === 'broth') {
      const idx = Math.min(2, Math.max(0, Math.floor((point.x - (s.x + 4)) / 64)));
      world.queueAction('broth', ['shoyu', 'miso', 'tonkotsu'][idx], cx);
    } else if (s.id === 'toppings') {
      const idx = Math.min(4, Math.max(0, Math.floor((point.x - (s.x + 4)) / 36)));
      world.queueAction('topping', ['egg', 'chashu', 'nori', 'negi', 'corn'][idx], cx);
    } else if (s.id === 'fryer') {
      const item = point.x < s.x + s.width / 2 ? 'gyoza' : 'karaage';
      world.queueAction('fry', item, cx);
    } else {
      world.queueAction('interact', null, cx);
    }
    return;
  }
  // Anywhere else on the floor: walk the chef there.
  if (point.y > 540) {
    state.chef.targetX = Math.min(1236, Math.max(40, point.x));
    state.chef.queued = null;
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (px, py, w, h) => {
    const scale = Math.min(w / 1280, h / 720);
    const ox = (w - 1280 * scale) / 2;
    const oy = (h - 720 * scale) / 2;
    return { x: (px - ox) / scale, y: (py - oy) / scale };
  });
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startShift() {
    world.resetGame();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Day 1. Take orders and serve ramen before patience runs out.');
  }

  function endShift() {
    screen = SCREEN_OVER;
    if (world.state.coins > best) {
      best = world.state.coins;
      saveBest(best);
    }
    announce(`Day ${world.state.day} complete. ${world.state.dayCoins} coins today, ${world.state.coins} in all.`);
  }

  function drainEvents() {
    const events = world.state.events.splice(0, world.state.events.length);
    for (const event of events) {
      if (event === 'serve') audio.serve();
      else if (event === 'error') audio.error();
      else if (event === 'ready') audio.ready();
      else if (event === 'blip') audio.blip();
      else if (event === 'pour') audio.pour();
      else if (event === 'arrive') audio.arrive();
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    const clicks = input.takeClicks();
    const clicked = clicks.length > 0;
    // Take the choice keys every frame so a press on another screen never fires later.
    const broth = input.takeBroth();
    const topping = input.takeTopping();
    const fry = input.takeFry();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE && ((actions & ACTION_INTERACT) || clicked)) {
      audio.unlock();
      startShift();
      return;
    }
    if (screen === SCREEN_OVER && ((actions & ACTION_INTERACT) || clicked)) {
      audio.unlock();
      world.nextDay();
      screen = SCREEN_PLAY;
      announce(`Day ${world.state.day}.`);
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return;
    }
    if (screen === SCREEN_PAUSED && ((actions & ACTION_PAUSE) || (actions & ACTION_INTERACT) || clicked)) {
      screen = SCREEN_PLAY;
      announce('Playing.');
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    if (world.currentStation() === 'broth') for (const b of broth) world.pourBroth(b);
    if (world.currentStation() === 'toppings') for (const t of topping) world.addTopping(t);
    if (world.currentStation() === 'fryer') for (const f of fry) world.startFry(f);
    if (actions & ACTION_SERVE) world.serveFirstMatch();
    if (actions & ACTION_TOSS) world.tossCarried();
    if (actions & ACTION_INTERACT) {
      audio.unlock();
      world.interact();
    }
    for (const point of clicks) {
      audio.unlock();
      handleClick(point);
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) return;
    world.step(STEP, input.direction());
    if (world.state.over) endShift();
    const cooking = world.state.pot.status === 'cooking' ||
      world.state.fryer.some((slot) => slot.status === 'cooking');
    if (cooking) audio.sizzle(STEP);
    drainEvents();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting patience drain unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  // R restarts from day 1 on the results screen.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyR' && screen === SCREEN_OVER) {
      startShift();
    }
  });

  announce('Ramen Rush. Press Space or click to open the shop.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

// Debug hook for play-testing: a summary of the staged or live world (no secrets).
window.__dbg = () => {
  const s = world.state;
  return {
    time: +s.time.toFixed(1), coins: s.coins, served: s.served, lost: s.lost,
    combo: s.combo, over: s.over,
    customers: s.customers.map((c) => ({ dish: c.dish, pat: +c.patience.toFixed(0), state: c.state })),
    carrying: s.carrying === null ? null : (s.carrying.kind === 'ramen'
      ? `ramen/${s.carrying.broth ?? '-'}[${(s.carrying.toppings ?? []).join(',')}]`
      : s.carrying.kind),
    pot: s.pot.status,
    pass: s.pass.map((p) => (p === null ? null : p.kind)),
  };
};
