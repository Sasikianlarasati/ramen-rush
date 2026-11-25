// Ramen Rush rules and state, with no drawing and no browser in it: the chef, the noodle
// pot, the broth ladles, the topping bins, the fryer, the tea tap, the serve pass, the
// customers and their patience, coins, combos and the shift clock. step() advances one fixed
// step; the actions below are what the chef does at a station. Nothing here allocates after
// createWorld returns, except the small floater and steam lists, which are capped.

import {
  BROTHS, CHEF, CUSTOMER, DISHES, ECONOMY, FRYER, ORDER_TABLE, POT,
  SEATS, SHIFT_SECONDS, STATIONS, TOPPINGS,
} from './config.js';
import { pickWeighted } from './random.js';

function stationAt(x) {
  for (const s of STATIONS) if (x >= s.x && x < s.x + s.width) return s.id;
  return null;
}

/** A bowl is finished only when it has noodles, its broth and every topping its dish needs. */
function isFinished(item) {
  if (item === null) return false;
  if (item.kind === 'ramen') {
    if (!item.noodles || item.broth === null) return false;
    const dish = Object.values(DISHES).find((d) => d.kind === 'ramen' && d.broth === item.broth);
    return dish !== undefined && dish.toppings.every((t) => item.toppings.includes(t));
  }
  return true;
}

function dishMatches(item, dishId) {
  const dish = DISHES[dishId];
  if (item === null || dish === undefined) return false;
  if (dish.kind === 'ramen') {
    if (item.kind !== 'ramen' || !isFinished(item)) return false;
    if (item.broth !== dish.broth) return false;
    return dish.toppings.every((t) => item.toppings.includes(t));
  }
  return item.kind === dishId;
}

/** Tip fraction: up to ECONOMY.tipMax of the price, by patience left, less for extra toppings. */
function tipFor(item, dishId, patienceFrac) {
  const dish = DISHES[dishId];
  let tip = dish.price * ECONOMY.tipMax * patienceFrac;
  if (item.kind === 'ramen') {
    const extra = item.toppings.filter((t) => !dish.toppings.includes(t)).length;
    tip *= Math.max(0, 1 - 0.1 * extra);
  }
  return Math.round(tip);
}

export function createWorld(random) {
  const state = {
    time: 0, shiftLeft: SHIFT_SECONDS, day: 1,
    coins: 0, dayCoins: 0, combo: 0, bestCombo: 0, served: 0, lost: 0,
    chef: { x: 640, targetX: null, queued: null },
    carrying: null,
    pot: { status: 'idle', t: 0 },
    fryer: [
      { item: 'gyoza', status: 'idle', t: 0 },
      { item: 'karaage', status: 'idle', t: 0 },
    ],
    pass: [null, null],
    customers: [],
    spawnTimer: CUSTOMER.spawnFirst,
    floaters: [],
    steam: [],
    events: [],
    over: false,
  };

  function floater(x, y, text, color) {
    if (state.floaters.length > 12) state.floaters.shift();
    state.floaters.push({ x, y, text, t: 0, color });
  }

  function spawnCustomer() {
    const free = SEATS.map((s, i) => i).filter((i) => !state.customers.some((c) => c.seat === i && c.state === 'waiting'));
    if (free.length === 0) return;
    const seat = free[Math.floor(random() * free.length)];
    const dish = pickWeighted(random, ORDER_TABLE);
    state.customers.push({
      seat, dish, patience: CUSTOMER.patience * Math.pow(CUSTOMER.patienceShrink, state.day - 1),
      max: CUSTOMER.patience * Math.pow(CUSTOMER.patienceShrink, state.day - 1),
      state: 'waiting', anim: 0, shake: 0,
    });
    state.events.push('arrive');
  }

  function resetShift(day) {
    state.time = 0;
    state.shiftLeft = SHIFT_SECONDS;
    state.day = day;
    state.dayCoins = 0;
    state.combo = 0;
    state.carrying = null;
    state.pot = { status: 'idle', t: 0 };
    state.fryer = [
      { item: 'gyoza', status: 'idle', t: 0 },
      { item: 'karaage', status: 'idle', t: 0 },
    ];
    state.pass = [null, null];
    state.customers = [];
    state.spawnTimer = CUSTOMER.spawnFirst;
    state.floaters = [];
    state.steam = [];
    state.over = false;
    state.chef.x = 640;
    state.chef.targetX = null;
    state.chef.queued = null;
  }

  function resetGame() {
    state.coins = 0;
    state.served = 0;
    state.lost = 0;
    state.bestCombo = 0;
    resetShift(1);
  }

  function nextDay() {
    resetShift(state.day + 1);
  }

  /** Walk the chef; a queued click-action runs when the chef reaches its station. */
  function moveChef(dt, dir) {
    const chef = state.chef;
    if (chef.targetX !== null) {
      const dx = chef.targetX - chef.x;
      const step = CHEF.speed * dt;
      if (Math.abs(dx) <= step + 2) {
        chef.x = chef.targetX;
        chef.targetX = null;
        if (chef.queued !== null) {
          const q = chef.queued;
          chef.queued = null;
          runAction(q.action, q.value);
        }
      } else {
        chef.x += Math.sign(dx) * step;
      }
      return;
    }
    if (dir !== 0) {
      // The clamp stays inside the pass zone: its right edge is exclusive.
      chef.x = Math.min(1236, Math.max(40, chef.x + dir * CHEF.speed * dt));
    }
  }

  function step(dt, dir) {
    if (state.over) return;
    state.time += dt;
    state.shiftLeft -= dt;
    if (state.shiftLeft <= 0) {
      state.shiftLeft = 0;
      state.over = true;
      return;
    }

    moveChef(dt, dir);

    // Noodle pot.
    if (state.pot.status === 'cooking') {
      state.pot.t += dt;
      if (state.pot.t >= POT.burn) state.pot.status = 'burnt';
      else if (state.pot.t >= POT.cook) {
        state.pot.status = 'done';
        state.events.push('ready');
      }
    }
    // Fryer baskets.
    for (const slot of state.fryer) {
      if (slot.status === 'cooking') {
        slot.t += dt;
        if (slot.t >= FRYER.burn) slot.status = 'burnt';
        else if (slot.t >= FRYER.cook) {
          slot.status = 'done';
          state.events.push('ready');
        }
      }
    }

    // Steam over anything hot.
    if ((state.pot.status === 'cooking' || state.pot.status === 'done') && state.steam.length < 40) {
      state.steam.push({ x: 110 + random() * 60, y: 520, r: 4 + random() * 5, t: 0, life: 1.1 });
    }
    for (const slot of state.fryer) {
      if (slot.status === 'cooking' && state.steam.length < 40) {
        state.steam.push({ x: 740 + random() * 120, y: 520, r: 4 + random() * 5, t: 0, life: 1.0 });
      }
    }
    for (let i = state.steam.length - 1; i >= 0; i -= 1) {
      const p = state.steam[i];
      p.t += dt;
      p.y -= 34 * dt;
      p.r += 6 * dt;
      if (p.t >= p.life) state.steam.splice(i, 1);
    }

    // Customers arrive, wait, and storm out.
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnCustomer();
      const base = Math.max(CUSTOMER.spawnMin, CUSTOMER.spawnBase - state.day);
      state.spawnTimer = base * (0.85 + random() * 0.3);
    }
    for (let i = state.customers.length - 1; i >= 0; i -= 1) {
      const c = state.customers[i];
      c.anim += dt;
      if (c.shake > 0) c.shake -= dt;
      if (c.state === 'waiting') {
        c.patience -= dt;
        if (c.patience <= 0) {
          c.state = 'leaving';
          c.anim = 0;
          state.lost += 1;
          state.combo = 0;
          const penalty = Math.min(state.coins, ECONOMY.walkoutPenalty);
          state.coins -= penalty;
          state.dayCoins -= penalty;
          floater(SEATS[c.seat].x, 150, `Walked out -${penalty}`, '#e5534b');
          state.events.push('error');
        }
      } else if (c.state === 'happy' || c.state === 'leaving') {
        if (c.anim > 0.9) state.customers.splice(i, 1);
      }
    }

    // Floaters rise and fade.
    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const f = state.floaters[i];
      f.t += dt;
      f.y -= 26 * dt;
      if (f.t > 1.2) state.floaters.splice(i, 1);
    }
  }

  /** The station the chef stands at, for hints and for Space. */
  function currentStation() {
    return stationAt(state.chef.x);
  }

  function runAction(action, value) {
    if (action === 'interact') return interact();
    if (action === 'broth') return pourBroth(value);
    if (action === 'topping') return addTopping(value);
    if (action === 'fry') return startFry(value);
    if (action === 'serve') return serveSeat(value);
    return false;
  }

  /** Queue a click: walk to the station, then do the action on arrival. */
  function queueAction(action, value, targetX) {
    state.chef.targetX = targetX;
    state.chef.queued = { action, value };
    return true;
  }

  function interact() {
    const at = currentStation();
    if (at === 'pot') return potAction();
    if (at === 'broth') { state.events.push('error'); return false; }
    if (at === 'toppings') { state.events.push('error'); return false; }
    if (at === 'fryer') return fryerAction();
    if (at === 'tea') return teaAction();
    if (at === 'pass') return passAction();
    return false;
  }

  function potAction() {
    const pot = state.pot;
    if (pot.status === 'idle') {
      pot.status = 'cooking';
      pot.t = 0;
      state.events.push('blip');
      return true;
    }
    if (pot.status === 'done') {
      if (state.carrying !== null) { state.events.push('error'); return false; }
      state.carrying = { kind: 'ramen', noodles: true, broth: null, toppings: [] };
      pot.status = 'idle';
      pot.t = 0;
      state.events.push('blip');
      return true;
    }
    if (pot.status === 'burnt') {
      pot.status = 'idle';
      pot.t = 0;
      floater(140, 500, 'Burnt! Tossed.', '#e5534b');
      state.events.push('error');
      return true;
    }
    return false; // still cooking: wait for the ring to fill
  }

  function pourBroth(id) {
    if (currentStation() !== 'broth') { state.events.push('error'); return false; }
    const bowl = state.carrying;
    if (bowl === null || bowl.kind !== 'ramen' || !bowl.noodles) { state.events.push('error'); return false; }
    if (bowl.broth !== null) { state.events.push('error'); return false; }
    if (!BROTHS.some((b) => b.id === id)) return false;
    bowl.broth = id;
    state.events.push('pour');
    return true;
  }

  function addTopping(id) {
    if (currentStation() !== 'toppings') { state.events.push('error'); return false; }
    const bowl = state.carrying;
    if (bowl === null || bowl.kind !== 'ramen' || !bowl.noodles || bowl.broth === null) {
      state.events.push('error');
      return false;
    }
    if (!TOPPINGS.some((t) => t.id === id)) return false;
    if (bowl.toppings.includes(id)) { state.events.push('error'); return false; }
    bowl.toppings.push(id);
    state.events.push('blip');
    return true;
  }

  function startFry(item) {
    if (currentStation() !== 'fryer') { state.events.push('error'); return false; }
    const slot = state.fryer.find((s) => s.item === item);
    if (slot === undefined || slot.status !== 'idle') { state.events.push('error'); return false; }
    slot.status = 'cooking';
    slot.t = 0;
    state.events.push('blip');
    return true;
  }

  function fryerAction() {
    const done = state.fryer.find((s) => s.status === 'done');
    if (done !== undefined) {
      if (state.carrying !== null) { state.events.push('error'); return false; }
      state.carrying = { kind: done.item };
      done.status = 'idle';
      done.t = 0;
      state.events.push('blip');
      return true;
    }
    const burnt = state.fryer.find((s) => s.status === 'burnt');
    if (burnt !== undefined) {
      burnt.status = 'idle';
      burnt.t = 0;
      floater(800, 500, 'Burnt! Tossed.', '#e5534b');
      state.events.push('error');
      return true;
    }
    return false;
  }

  function teaAction() {
    if (state.carrying !== null) { state.events.push('error'); return false; }
    state.carrying = { kind: 'tea' };
    state.events.push('pour');
    return true;
  }

  function passAction() {
    if (state.carrying !== null) {
      if (!isFinished(state.carrying)) { state.events.push('error'); return false; }
      const free = state.pass.findIndex((p) => p === null);
      if (free === -1) { state.events.push('error'); return false; }
      state.pass[free] = state.carrying;
      state.carrying = null;
      state.events.push('blip');
      return true;
    }
    const taken = state.pass.findIndex((p) => p !== null);
    if (taken === -1) { state.events.push('error'); return false; }
    state.carrying = state.pass[taken];
    state.pass[taken] = null;
    state.events.push('blip');
    return true;
  }

  /** Toss what the chef carries (a wrong dish, or one nobody ordered) into the bin. */
  function tossCarried() {
    if (state.carrying === null) return false;
    state.carrying = null;
    floater(state.chef.x, 520, 'Tossed', '#c9a582');
    state.events.push('blip');
    return true;
  }

  /** Serve a waiting customer: the carried dish first, then a ready plate from the pass. */
  function serveSeat(seat) {
    const customer = state.customers.find((c) => c.seat === seat && c.state === 'waiting');
    if (customer === undefined) return false;
    let source = null;
    let item = null;
    if (state.carrying !== null && dishMatches(state.carrying, customer.dish)) {
      source = 'hands';
      item = state.carrying;
    } else {
      const slot = state.pass.findIndex((p) => dishMatches(p, customer.dish));
      if (slot !== -1) {
        source = 'pass';
        item = state.pass[slot];
        state.pass[slot] = null;
      }
    }
    if (item === null) {
      customer.shake = 0.4;
      if (state.carrying !== null && isFinished(state.carrying)) state.combo = 0;
      state.events.push('error');
      return false;
    }
    if (source === 'hands') state.carrying = null;
    const dish = DISHES[customer.dish];
    const mult = 1 + Math.min(state.combo, 10) * ECONOMY.comboStep;
    const capped = Math.min(mult, ECONOMY.comboMax);
    const tip = tipFor(item, customer.dish, Math.max(0, customer.patience / customer.max));
    const earned = Math.round((dish.price + tip) * capped);
    state.coins += earned;
    state.dayCoins += earned;
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.served += 1;
    customer.state = 'happy';
    customer.anim = 0;
    floater(SEATS[seat].x, 150, `+${earned}`, '#f2c94c');
    if (state.combo >= 3) floater(SEATS[seat].x, 120, `Combo x${capped.toFixed(1)}`, '#7dc383');
    state.events.push('serve');
    return true;
  }

  /** Keyboard serve: the first waiting customer whose order the hands or the pass can fill. */
  function serveFirstMatch() {
    for (const c of state.customers) {
      if (c.state !== 'waiting') continue;
      if ((state.carrying !== null && dishMatches(state.carrying, c.dish)) ||
          state.pass.some((p) => dishMatches(p, c.dish))) {
        return serveSeat(c.seat);
      }
    }
    state.events.push('error');
    return false;
  }

  return {
    state, resetGame, resetShift, nextDay, step,
    stationAt, currentStation, interact, runAction, queueAction,
    pourBroth, addTopping, startFry, serveSeat, serveFirstMatch, tossCarried,
    isFinished, dishMatches,
  };
}
