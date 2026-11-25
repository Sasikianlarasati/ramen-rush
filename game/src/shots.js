// The screenshot scenes behind ?shot=start|play|serve|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (walk to the station the next step of the oldest order needs, cook, assemble, serve),
// so the frame is what a short game really looks like and the same seed always gives the
// same frame. The serve scene holds the finished dish on the pass instead of serving it,
// so the shot shows a plate ready to serve.
import { DISHES, STATIONS, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 12;
const PLAY_SECONDS = 26;
const SERVE_LIMIT_SECONDS = 90;
const END_LIMIT_SECONDS = 160;

function stationCenter(id) {
  const s = STATIONS.find((st) => st.id === id);
  return s.x + s.width / 2;
}

function oldestOrder(state) {
  let best = null;
  for (const c of state.customers) {
    if (c.state !== 'waiting') continue;
    if (best === null || c.patience < best.patience) best = c;
  }
  return best;
}

function oldestRamenOrder(state) {
  let best = null;
  for (const c of state.customers) {
    if (c.state !== 'waiting') continue;
    if (DISHES[c.dish].kind !== 'ramen') continue;
    if (best === null || c.patience < best.patience) best = c;
  }
  return best;
}

function neededTopping(bowl) {
  const dish = Object.values(DISHES).find((d) => d.kind === 'ramen' && d.broth === bowl.broth);
  if (dish === undefined) return null;
  return dish.toppings.find((t) => !bowl.toppings.includes(t)) ?? null;
}

/**
 * One autopilot step: move the chef toward what the oldest order needs next, and act
 * when the chef stands at the right station. `holdForPass` makes the pilot put finished
 * dishes on the serve pass instead of serving them (the serve screenshot).
 * Returns the steering direction for this step.
 */
function autopilot(world, holdForPass) {
  const s = world.state;
  const chef = s.chef;
  const at = world.currentStation();
  const carrying = s.carrying;

  function goTo(stationId) {
    const target = stationCenter(stationId);
    if (Math.abs(chef.x - target) < 6) return 0;
    return chef.x < target ? 1 : -1;
  }

  // Burnt food gets tossed before anything else.
  if (s.pot.status === 'burnt') {
    if (at === 'pot') { world.interact(); return 0; }
    return goTo('pot');
  }
  const burntSlot = s.fryer.find((slot) => slot.status === 'burnt');
  if (burntSlot !== undefined && s.pot.status !== 'burnt') {
    if (at === 'fryer') { world.interact(); return 0; }
    return goTo('fryer');
  }

  // A finished dish in hand: serve it, or hold it on the pass for the serve shot.
  if (carrying !== null && world.isFinished(carrying)) {
    const order = oldestOrder(s);
    if (order !== null && world.dishMatches(carrying, order.dish)) {
      if (holdForPass) {
        if (at === 'pass') { world.interact(); return 0; }
        return goTo('pass');
      }
      world.serveSeat(order.seat);
      return 0;
    }
    // No order for it: put it on the pass for a later customer — or toss it when the
    // pass is full, so the chef is free to cook what the orders actually need.
    if (s.pass.some((p) => p === null)) {
      if (at === 'pass') { world.interact(); return 0; }
      return goTo('pass');
    }
    world.tossCarried();
    return 0;
  }

  // A ready plate on the pass fills a waiting order: serve it straight from the pass.
  // (Not in the serve shot, where the plate is meant to stay on the pass for the frame.)
  if (!holdForPass) {
    for (const c of s.customers) {
      if (c.state !== 'waiting') continue;
      if (s.pass.some((p) => world.dishMatches(p, c.dish))) {
        world.serveSeat(c.seat);
        return 0;
      }
    }
  }

  // A bowl mid-assembly: broth, then toppings.
  if (carrying !== null && carrying.kind === 'ramen') {
    if (carrying.broth === null) {
      const ramenOrder = oldestRamenOrder(s);
      const broth = ramenOrder !== null ? DISHES[ramenOrder.dish].broth : 'shoyu';
      if (at === 'broth') { world.pourBroth(broth); return 0; }
      return goTo('broth');
    }
    const topping = neededTopping(carrying);
    if (topping !== null) {
      if (at === 'toppings') { world.addTopping(topping); return 0; }
      return goTo('toppings');
    }
    // Bowl complete but no order matches yet: hold it on the pass.
    if (at === 'pass') { world.interact(); return 0; }
    return goTo('pass');
  }

  // Hands empty: take what is ready.
  if (s.pot.status === 'done') {
    if (at === 'pot') { world.interact(); return 0; }
    return goTo('pot');
  }
  const doneSlot = s.fryer.find((slot) => slot.status === 'done');
  if (doneSlot !== undefined) {
    if (at === 'fryer') { world.interact(); return 0; }
    return goTo('fryer');
  }

  // Hands empty, nothing ready: start what the orders need — noodles only when a
  // ramen order is actually waiting, so the pass never clogs with bowls nobody asked for.
  const order = oldestOrder(s);
  const ramenOrder = oldestRamenOrder(s);
  if (ramenOrder !== null) {
    if (s.pot.status === 'idle') {
      if (at === 'pot') { world.interact(); return 0; }
      return goTo('pot');
    }
    return 0; // noodles already cooking: wait by the pot
  }
  if (order !== null && DISHES[order.dish].kind === 'fryer') {
    const dish = DISHES[order.dish];
    const slot = s.fryer.find((sl) => sl.item === dish.fry);
    if (slot !== undefined && slot.status === 'idle') {
      if (at === 'fryer') { world.startFry(dish.fry); return 0; }
      return goTo('fryer');
    }
    return 0;
  }
  if (order !== null && DISHES[order.dish].kind === 'tea') {
    if (at === 'tea') { world.interact(); return 0; }
    return goTo('tea');
  }
  // No orders at all: wait by the pot for the next customer.
  return 0;
}

/**
 * Set `world` to the named scene (start, play, serve or end; any other name is start)
 * and return the screen to draw over it and the best total to show.
 */
export function stageShot(name, world) {
  world.resetGame();
  if (name !== 'play' && name !== 'serve' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, autopilot(world, false));
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'serve') {
    for (let index = 0; index < SERVE_LIMIT_SECONDS / STEP; index += 1) {
      world.step(STEP, autopilot(world, true));
      const waiting = world.state.customers.some((c) => c.state === 'waiting');
      const ready = world.state.pass.some((p) => p !== null);
      if ((ready && waiting) || world.state.served > 0) break;
      if (world.state.over) break;
    }
    return { screen: SCREEN_PLAY, best: world.state.coins };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  for (let index = 0; index < limit / STEP; index += 1) {
    if (world.state.over) break;
    world.step(STEP, autopilot(world, false));
  }
  const over = world.state.over;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.coins };
}
