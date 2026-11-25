// Keyboard and pointer input. Held keys steer the chef; one-shot presses (interact,
// broth and topping choices, fryer picks, serve, pause, mute) are queued as actions and
// taken once by the loop, so a press between two frames is never lost and never counted
// twice. Clicks are reported in logical playfield coordinates for the main loop to map
// onto stations, bins, ladles, baskets and customers.

export const ACTION_INTERACT = 1;
export const ACTION_PAUSE = 2;
export const ACTION_SERVE = 4;
export const ACTION_MUTE = 8;
export const ACTION_TOSS = 16;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const INTERACT = new Set(['Space', 'KeyE', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const SERVE = new Set(['KeyS']);
const MUTE = new Set(['KeyM']);
const TOSS = new Set(['KeyX']);

const BROTH_KEYS = { Digit1: 'shoyu', Digit2: 'miso', Digit3: 'tonkotsu' };
const TOPPING_KEYS = { Digit4: 'egg', Digit5: 'chashu', Digit6: 'nori', Digit7: 'negi', Digit8: 'corn' };
const FRY_KEYS = { KeyG: 'gyoza', KeyK: 'karaage' };

export function createInput(canvas, toLogical) {
  let left = false;
  let right = false;
  let actions = 0;
  // Choice keys queue up: pressing 4 then 6 quickly must add both toppings, even
  // when no frame runs between the two presses.
  const brothQueue = [];
  const toppingQueue = [];
  const fryQueue = [];
  const clicks = [];

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (INTERACT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_INTERACT;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (SERVE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_SERVE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (TOSS.has(event.code)) {
      if (!event.repeat) actions |= ACTION_TOSS;
    } else if (BROTH_KEYS[event.code] !== undefined) {
      if (!event.repeat) brothQueue.push(BROTH_KEYS[event.code]);
    } else if (TOPPING_KEYS[event.code] !== undefined) {
      if (!event.repeat) toppingQueue.push(TOPPING_KEYS[event.code]);
    } else if (FRY_KEYS[event.code] !== undefined) {
      if (!event.repeat) fryQueue.push(FRY_KEYS[event.code]);
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const point = toLogical(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
    clicks.push(point);
  });

  return {
    /** -1 for left, 1 for right, 0 for neither or both. */
    direction() {
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeBroth() { return brothQueue.splice(0, brothQueue.length); },
    takeTopping() { return toppingQueue.splice(0, toppingQueue.length); },
    takeFry() { return fryQueue.splice(0, fryQueue.length); },
    /** Click points since the last call, in logical playfield coordinates. */
    takeClicks() {
      return clicks.splice(0, clicks.length);
    },
  };
}
