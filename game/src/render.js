// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. All art is drawn with canvas primitives (no image files): lanterns, wooden
// counters, steaming pots, bowls of ramen, gyoza, karaage and the chef. Text that holds a
// number is rebuilt only when the number changes, so a frame allocates nothing.

import {
  BROTHS, CHEF, DISHES, FIELD, FONT, FRYER, PALETTE, POT, SEATS,
  SHIFT_SECONDS, STATIONS, TOPPINGS,
} from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 150, line: 34, bottom: 76 };
const TICKET = { w: 236, h: 76, gap: 14 };

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const coinsLabel = cachedLabel('Coins ');
  const dayLabel = cachedLabel('Day ');
  const comboLabel = cachedLabel('Combo x');
  const timeLabel = cachedLabel('');
  const servedLabel = cachedLabel('Served ');
  const lostLabel = cachedLabel('Walked out ');
  const bestLabel = cachedLabel('Best total ');
  const totalLabel = cachedLabel('Total coins ');
  const finalLabel = cachedLabel('Coins today ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = size + (weight === 'bold' ? 'b' : '');
    if (!fonts.has(key)) fonts.set(key, `${weight === 'bold' ? '700 ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function circle(x, y, r, color) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
  }

  function rect(x, y, w, h, color) {
    context.fillStyle = color;
    context.fillRect(x, y, w, h);
  }

  function ring(x, y, r, frac, color, width) {
    context.strokeStyle = color;
    context.lineWidth = width;
    context.beginPath();
    context.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp01(frac));
    context.stroke();
  }

  /** A bowl of ramen, drawn at (x, y) with radius r; toppings shown as their own marks. */
  function drawRamenBowl(x, y, r, bowl) {
    circle(x, y, r, '#f5f0e6');
    const broth = BROTHS.find((b) => b.id === bowl.broth);
    circle(x, y, r * 0.78, broth ? broth.color : '#c98d4b');
    // Noodle squiggles.
    context.strokeStyle = '#f2d38a';
    context.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      context.beginPath();
      const yy = y - 6 + i * 6;
      context.moveTo(x - r * 0.5, yy);
      context.bezierCurveTo(x - r * 0.2, yy - 5, x + r * 0.2, yy + 5, x + r * 0.5, yy);
      context.stroke();
    }
    if (bowl.toppings.includes('egg')) {
      circle(x - r * 0.35, y - r * 0.3, r * 0.26, '#fff3d6');
      circle(x - r * 0.35, y - r * 0.3, r * 0.13, '#f2a93b');
    }
    if (bowl.toppings.includes('chashu')) {
      circle(x + r * 0.35, y - r * 0.3, r * 0.26, '#e8a0a0');
      circle(x + r * 0.35, y - r * 0.3, r * 0.14, '#c96a6a');
    }
    if (bowl.toppings.includes('nori')) rect(x - r * 0.55, y + r * 0.28, r * 0.5, r * 0.34, '#2e4d2e');
    if (bowl.toppings.includes('negi')) {
      rect(x - r * 0.1, y + r * 0.3, r * 0.24, r * 0.1, '#7dc383');
      rect(x + r * 0.14, y + r * 0.42, r * 0.24, r * 0.1, '#7dc383');
    }
    if (bowl.toppings.includes('corn')) {
      circle(x + r * 0.42, y + r * 0.32, r * 0.1, '#f2d13d');
      circle(x + r * 0.24, y + r * 0.44, r * 0.1, '#f2d13d');
    }
  }

  function drawPlate(x, y, r, kind) {
    circle(x, y, r, '#f5f0e6');
    if (kind === 'gyoza') {
      for (let i = 0; i < 3; i += 1) {
        const gx = x - r * 0.5 + i * r * 0.5;
        context.fillStyle = '#f2e3c2';
        context.beginPath();
        context.ellipse(gx, y - 1, r * 0.22, r * 0.3, 0, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = '#c98d4b';
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(gx - r * 0.18, y - r * 0.2);
        context.lineTo(gx + r * 0.18, y - r * 0.2);
        context.stroke();
      }
    } else if (kind === 'karaage') {
      const spots = [[-0.35, -0.1], [0.05, -0.25], [0.4, 0.05], [-0.05, 0.25], [0.35, -0.35]];
      for (const [dx, dy] of spots) {
        circle(x + dx * r, y + dy * r, r * 0.2, '#b06a2e');
        circle(x + dx * r - 2, y + dy * r - 2, r * 0.08, '#d99a55');
      }
    }
  }

  function drawTeaCup(x, y, r) {
    rect(x - r * 0.7, y - r * 0.5, r * 1.4, r, '#7ba05b');
    context.strokeStyle = '#5d7a44';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x + r * 0.75, y, r * 0.35, -Math.PI / 2, Math.PI / 2);
    context.stroke();
    rect(x - r * 0.7, y - r * 0.5, r * 1.4, 3, '#a8c68a');
  }

  /** Any finished or in-progress item, drawn small (tickets, pass, carried). */
  function drawItem(x, y, r, item) {
    if (item === null) return;
    if (item.kind === 'ramen') drawRamenBowl(x, y, r, item);
    else if (item.kind === 'tea') drawTeaCup(x, y, r);
    else drawPlate(x, y, r, item.kind);
  }

  /** Mini dish icon for tickets and thought bubbles. */
  function drawDishIcon(x, y, r, dishId) {
    const dish = DISHES[dishId];
    if (dish.kind === 'ramen') {
      drawRamenBowl(x, y, r, { broth: dish.broth, toppings: dish.toppings, noodles: true });
    } else if (dish.kind === 'tea') drawTeaCup(x, y, r);
    else drawPlate(x, y, r, dishId);
  }

  function drawWall(state) {
    rect(0, 0, FIELD.width, 108, PALETTE.wall);
    rect(0, 104, FIELD.width, 6, PALETTE.wallTrim);
    // Paper lanterns.
    for (const lx of [90, 1190]) {
      context.fillStyle = PALETTE.lantern;
      context.beginPath();
      context.ellipse(lx, 52, 34, 42, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.lanternGlow;
      context.beginPath();
      context.ellipse(lx, 52, 20, 30, 0, 0, Math.PI * 2);
      context.fill();
      rect(lx - 2, 6, 4, 8, '#3a2412');
      rect(lx - 2, 92, 4, 8, '#3a2412');
    }
    // Shop sign.
    rect(440, 18, 400, 64, '#1d1206');
    context.strokeStyle = PALETTE.lantern;
    context.lineWidth = 3;
    context.strokeRect(440, 18, 400, 64);
    context.textBaseline = 'alphabetic';
    text('RAMEN RUSH', 640, 56, 34, '#f2c94c', 'center', 'bold');
    text('TOKYO NOODLE BAR  •  ラーメン', 640, 74, 13, PALETTE.muted, 'center');
    // HUD: day, coins, combo (left), timer (right).
    context.textBaseline = 'alphabetic';
    text(dayLabel(state.day), 180, 46, 24, PALETTE.text, 'left', 'bold');
    text(coinsLabel(state.coins), 180, 76, 22, PALETTE.coin, 'left');
    if (state.combo >= 2) text(comboLabel(state.combo), 330, 76, 22, PALETTE.good, 'left', 'bold');
    const secs = Math.max(0, Math.ceil(state.shiftLeft));
    const mm = String(Math.floor(secs / 60));
    const ss = String(secs % 60).padStart(2, '0');
    text(timeLabel(`${mm}:${ss}`), 1100, 58, 40, state.shiftLeft <= 15 ? PALETTE.bad : PALETTE.text, 'center', 'bold');
    text('SHIFT', 1100, 82, 13, PALETTE.muted, 'center');
  }

  function drawTickets(state) {
    const waiting = state.customers.filter((c) => c.state === 'waiting');
    waiting.forEach((c, i) => {
      const x = 24 + i * (TICKET.w + TICKET.gap);
      const y = 122;
      const dish = DISHES[c.dish];
      rect(x, y, TICKET.w, TICKET.h, PALETTE.ticket);
      rect(x, y, TICKET.w, 5, c.patience / c.max > 0.5 ? PALETTE.good : c.patience / c.max > 0.25 ? PALETTE.coin : PALETTE.bad);
      drawDishIcon(x + 34, y + 42, 24, c.dish);
      context.textBaseline = 'alphabetic';
      text(dish.name, x + 66, y + 30, 19, PALETTE.ticketInk, 'left', 'bold');
      const extra = dish.kind === 'ramen' ? dish.toppings.map((t) => TOPPINGS.find((tp) => tp.id === t).name).join(' + ') : 'Ready to fry';
      text(dish.kind === 'ramen' ? extra : dish.kind === 'tea' ? 'Hot green tea' : 'From the fryer', x + 66, y + 52, 14, '#7a5a34', 'left');
      // Patience bar.
      rect(x + 66, y + 60, 150, 8, '#d9c9a8');
      rect(x + 66, y + 60, 150 * clamp01(c.patience / c.max), 8, c.patience / c.max > 0.5 ? PALETTE.good : c.patience / c.max > 0.25 ? PALETTE.coin : PALETTE.bad);
      text(`Seat ${c.seat + 1}`, x + TICKET.w - 10, y + 52, 13, '#7a5a34', 'right');
    });
    if (waiting.length === 0) {
      context.textBaseline = 'alphabetic';
      text('No orders yet — the first customer is on their way…', 24, 168, 18, PALETTE.muted, 'left');
    }
  }

  const CUSTOMER_LOOKS = [
    { skin: '#f2c49b', hair: '#2b2b2b', shirt: '#c94f4f' },
    { skin: '#e8b48a', hair: '#6b4423', shirt: '#4f7dc9' },
    { skin: '#f2c49b', hair: '#8a8a8a', shirt: '#5da85d' },
    { skin: '#d9a06a', hair: '#1d1d1d', shirt: '#c9a13b' },
  ];

  function drawCustomers(state) {
    // Eating counter.
    rect(0, 300, FIELD.width, 18, PALETTE.counterTop);
    rect(0, 318, FIELD.width, 42, PALETTE.counter);
    rect(0, 318, FIELD.width, 4, PALETTE.counterEdge);
    for (const c of state.customers) {
      const seat = SEATS[c.seat];
      const look = CUSTOMER_LOOKS[(c.seat + state.day) % CUSTOMER_LOOKS.length];
      const bob = c.state === 'happy' ? Math.sin(c.anim * 14) * 4 : Math.sin(c.anim * 2 + c.seat) * 1.5;
      const shakeX = c.shake > 0 ? Math.sin(c.anim * 40) * 4 : 0;
      const x = seat.x + shakeX;
      const y = seat.y + bob;
      if (c.state === 'leaving') {
        // Storming out: slide up and fade.
        const f = clamp01(c.anim / 0.9);
        context.globalAlpha = 1 - f;
        circle(x, y - f * 30, 26, look.skin);
        context.globalAlpha = 1;
        continue;
      }
      // Body behind the counter, head above it.
      rect(x - 34, 268, 68, 34, look.shirt);
      circle(x, y, 26, look.skin);
      // Hair.
      context.fillStyle = look.hair;
      context.beginPath();
      context.arc(x, y - 6, 26, Math.PI, Math.PI * 2);
      context.fill();
      rect(x - 26, y - 10, 52, 8, look.hair);
      // Eyes and smile (or happy closed eyes).
      if (c.state === 'happy') {
        context.strokeStyle = '#2b2b2b';
        context.lineWidth = 2;
        for (const ex of [-9, 9]) {
          context.beginPath();
          context.arc(x + ex, y + 2, 5, Math.PI, Math.PI * 2);
          context.stroke();
        }
      } else {
        circle(x - 9, y + 2, 2.5, '#2b2b2b');
        circle(x + 9, y + 2, 2.5, '#2b2b2b');
      }
      context.strokeStyle = '#2b2b2b';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(x, y + 10, 7, 0.15 * Math.PI, 0.85 * Math.PI);
      context.stroke();
      // Thought bubble with the order.
      const bx = x + 44;
      const by = y - 62;
      circle(bx, by, 30, '#fdf3d8');
      circle(x + 30, y - 28, 7, '#fdf3d8');
      circle(x + 22, y - 16, 4, '#fdf3d8');
      drawDishIcon(bx, by, 20, c.dish);
      // Patience ring around the bubble.
      const frac = clamp01(c.patience / c.max);
      ring(bx, by, 34, frac, frac > 0.5 ? PALETTE.good : frac > 0.25 ? PALETTE.coin : PALETTE.bad, 4);
    }
    // Empty stools.
    for (let i = 0; i < SEATS.length; i += 1) {
      if (state.customers.some((c) => c.seat === i)) continue;
      const seat = SEATS[i];
      rect(seat.x - 26, 300, 52, 10, '#5d3617');
      rect(seat.x - 4, 310, 8, 50, '#5d3617');
    }
  }

  function drawStations(state) {
    // Kitchen counter band.
    rect(0, 372, FIELD.width, 14, PALETTE.counterTop);
    rect(0, 386, FIELD.width, 150, PALETTE.counter);
    rect(0, 386, FIELD.width, 4, PALETTE.counterEdge);
    // Floor.
    rect(0, 536, FIELD.width, 184, PALETTE.floor);
    context.strokeStyle = 'rgba(0,0,0,0.25)';
    context.lineWidth = 2;
    for (let y = 570; y < 720; y += 34) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
      context.stroke();
    }

    const highlight = state.chef !== undefined ? stationAtChef(state) : null;
    for (const s of STATIONS) {
      const cx = s.x + s.width / 2;
      if (highlight === s.id) {
        context.strokeStyle = '#f2c94c';
        context.lineWidth = 3;
        context.strokeRect(s.x + 4, 392, s.width - 8, 128);
      }
      context.textBaseline = 'alphabetic';
      text(s.label, cx, 528, 15, PALETTE.muted, 'center');
      if (s.id === 'pot') drawPot(state, cx);
      else if (s.id === 'broth') drawBroth(state, s);
      else if (s.id === 'toppings') drawToppings(state, s);
      else if (s.id === 'fryer') drawFryer(state, s);
      else if (s.id === 'tea') drawTea(state, cx);
      else if (s.id === 'pass') drawPass(state, s);
    }

    // Steam.
    for (const p of state.steam) {
      context.globalAlpha = Math.max(0, 0.35 * (1 - p.t / p.life));
      circle(p.x, p.y, p.r, '#e8e0d0');
    }
    context.globalAlpha = 1;

    // Floaters.
    context.textBaseline = 'alphabetic';
    for (const f of state.floaters) {
      context.globalAlpha = Math.max(0, 1 - f.t / 1.2);
      text(f.text, f.x, f.y, 22, f.color, 'center', 'bold');
    }
    context.globalAlpha = 1;
  }

  function stationAtChef(state) {
    for (const s of STATIONS) if (state.chef.x >= s.x && state.chef.x < s.x + s.width) return s.id;
    return null;
  }

  function drawPot(state, cx) {
    const pot = state.pot;
    // Burner + pot.
    circle(cx, 505, 52, '#1d1206');
    rect(cx - 58, 448, 116, 56, PALETTE.pot);
    context.fillStyle = '#5a6672';
    context.fillRect(cx - 58, 448, 116, 10);
    const water = pot.status === 'burnt' ? '#3a2a1a' : pot.status === 'idle' ? '#2a343e' : '#7fb3d9';
    context.fillStyle = water;
    context.beginPath();
    context.ellipse(cx, 456, 52, 10, 0, 0, Math.PI * 2);
    context.fill();
    if (pot.status === 'cooking' || pot.status === 'done') {
      // Noodle strands in the water.
      context.strokeStyle = '#f2d38a';
      context.lineWidth = 3;
      for (let i = 0; i < 4; i += 1) {
        context.beginPath();
        const yy = 452 + i * 3;
        context.moveTo(cx - 34 + i * 4, yy);
        context.bezierCurveTo(cx - 12, yy - 5, cx + 12, yy + 5, cx + 34 - i * 4, yy);
        context.stroke();
      }
    }
    if (pot.status === 'cooking') {
      ring(cx, 448, 64, pot.t / POT.cook, '#f2c94c', 6);
      text('Cooking…', cx, 420, 14, PALETTE.text, 'center');
    } else if (pot.status === 'done') {
      ring(cx, 448, 64, 1, PALETTE.good, 6);
      text('Ready! Space to take', cx, 420, 14, PALETTE.good, 'center', 'bold');
    } else if (pot.status === 'burnt') {
      ring(cx, 448, 64, 1, PALETTE.bad, 6);
      text('Burnt! Space to toss', cx, 420, 14, PALETTE.bad, 'center', 'bold');
    } else {
      text('Space: start noodles', cx, 420, 14, PALETTE.muted, 'center');
    }
  }

  function drawBroth(state, s) {
    BROTHS.forEach((b, i) => {
      const x = s.x + 36 + i * 64;
      const y = 478;
      circle(x, y, 26, '#3f4a55');
      circle(x, y - 4, 21, b.color);
      context.strokeStyle = b.light;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(x, y - 4, 14, 0, Math.PI * 2);
      context.stroke();
      text(`${i + 1}`, x, y + 30, 12, PALETTE.text, 'center', 'bold');
      text(b.name, x, 436, 13, PALETTE.muted, 'center');
    });
    const bowl = state.carrying;
    if (bowl !== null && bowl.kind === 'ramen' && bowl.noodles && bowl.broth === null) {
      text('Pick a broth: 1 / 2 / 3', s.x + s.width / 2, 420, 14, PALETTE.good, 'center', 'bold');
    }
  }

  function drawToppings(state, s) {
    TOPPINGS.forEach((t, i) => {
      const x = s.x + 22 + i * 36;
      const y = 478;
      rect(x - 15, y - 14, 30, 34, '#3f4a55');
      rect(x - 12, y - 11, 24, 12, t.color);
      text(`${i + 4}`, x, y + 34, 12, PALETTE.text, 'center');
      text(t.name, x, 436, 11, PALETTE.muted, 'center');
    });
    const bowl = state.carrying;
    if (bowl !== null && bowl.kind === 'ramen' && bowl.noodles && bowl.broth !== null) {
      const dish = Object.values(DISHES).find((d) => d.kind === 'ramen' && d.broth === bowl.broth);
      const need = dish ? dish.toppings.filter((t) => !bowl.toppings.includes(t)) : [];
      text(need.length > 0 ? `Needs: ${need.join(' + ')}` : 'Bowl complete!', s.x + s.width / 2, 420, 14, PALETTE.good, 'center', 'bold');
    }
  }

  function drawFryer(state, s) {
    state.fryer.forEach((slot, i) => {
      const x = s.x + 52 + i * 96;
      const y = 478;
      rect(x - 44, y - 20, 88, 40, '#3f4a55');
      rect(x - 38, y - 14, 76, 26, PALETTE.fryerOil);
      if (slot.status === 'cooking' || slot.status === 'done') {
        // Bubbles.
        for (let b = 0; b < 5; b += 1) {
          circle(x - 28 + b * 14, y - 6 - ((state.time * 30 + b * 13) % 12), 3, '#f7d774');
        }
        if (slot.status === 'cooking') ring(x, y - 2, 46, slot.t / FRYER.cook, '#f2c94c', 5);
        else ring(x, y - 2, 46, 1, PALETTE.good, 5);
      }
      if (slot.status === 'burnt') {
        rect(x - 38, y - 14, 76, 26, '#3a2a1a');
        text('Burnt!', x, 436, 13, PALETTE.bad, 'center', 'bold');
      }
      text(slot.item === 'gyoza' ? 'Gyoza [G]' : 'Karaage [K]', x, 436, 13, PALETTE.muted, 'center');
      if (slot.status === 'done') text('Space to take', x, 420, 13, PALETTE.good, 'center', 'bold');
    });
  }

  function drawTea(state, cx) {
    circle(cx, 478, 30, '#3f4a55');
    circle(cx, 478, 24, PALETTE.teaGreen);
    rect(cx - 4, 440, 8, 22, '#5d7a44');
    text('Space: pour tea', cx, 420, 13, PALETTE.muted, 'center');
  }

  function drawPass(state, s) {
    rect(s.x + 8, 448, s.width - 16, 12, '#d9c9a8');
    rect(s.x + 8, 460, s.width - 16, 44, '#8a6a42');
    state.pass.forEach((item, i) => {
      if (item === null) return;
      drawItem(s.x + 48 + i * 80, 440, 26, item);
    });
    const carrying = state.carrying;
    const ready = state.pass.some((p) => p !== null);
    if (carrying !== null && carrying.kind !== undefined) {
      const dish = carrying.kind === 'ramen' && carrying.broth !== null
        ? Object.values(DISHES).find((d) => d.kind === 'ramen' && d.broth === carrying.broth)
        : null;
      const done = carrying.kind !== 'ramen' ||
        (dish !== undefined && dish !== null && carrying.noodles &&
          dish.toppings.every((t) => carrying.toppings.includes(t)));
      if (done) text('Space: place on pass', s.x + s.width / 2, 420, 13, PALETTE.good, 'center', 'bold');
    } else if (ready) {
      text('Space: pick up', s.x + s.width / 2, 420, 13, PALETTE.good, 'center', 'bold');
    }
  }

  function drawChef(state) {
    const chef = state.chef;
    const x = chef.x;
    const y = CHEF.y;
    const carrying = state.carrying;
    // Legs and body.
    rect(x - 20, y + 28, 16, 34, '#2b2b2b');
    rect(x + 4, y + 28, 16, 34, '#2b2b2b');
    rect(x - 24, y - 6, 48, 40, PALETTE.chefCoat);
    rect(x - 24, y - 6, 48, 34, PALETTE.chefApron);
    // Arms.
    rect(x - 30, y - 2, 10, 30, PALETTE.chefCoat);
    rect(x + 20, y - 2, 10, 30, PALETTE.chefCoat);
    // Head.
    circle(x, y - 22, 20, PALETTE.chefSkin);
    circle(x - 7, y - 24, 2.5, '#2b2b2b');
    circle(x + 7, y - 24, 2.5, '#2b2b2b');
    context.strokeStyle = '#2b2b2b';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x, y - 16, 6, 0.15 * Math.PI, 0.85 * Math.PI);
    context.stroke();
    // Chef hat.
    rect(x - 18, y - 46, 36, 12, PALETTE.chefHat);
    circle(x - 12, y - 48, 10, PALETTE.chefHat);
    circle(x, y - 52, 12, PALETTE.chefHat);
    circle(x + 12, y - 48, 10, PALETTE.chefHat);
    // Carried dish, held up front.
    if (carrying !== null) {
      drawItem(x + 34, y + 6, 24, carrying);
      if (carrying.kind === 'ramen' && carrying.broth === null) {
        text('Noodles — needs broth', x, y - 66, 13, PALETTE.text, 'center');
      }
    }
    // Walk target marker.
    if (chef.targetX !== null) {
      context.strokeStyle = '#f2c94c';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(chef.targetX, y + 66);
      context.lineTo(chef.targetX - 6, y + 56);
      context.lineTo(chef.targetX + 6, y + 56);
      context.closePath();
      context.stroke();
    }
  }

  function drawHelp() {
    context.textBaseline = 'alphabetic';
    text('← → move   •   Space interact   •   1-3 broth   •   4-8 toppings   •   G gyoza / K karaage   •   S serve   •   X toss   •   P pause   •   M mute', 640, 700, 15, PALETTE.muted, 'center');
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    rect(x, y, PANEL.width, height, '#252b38');
    context.strokeStyle = PALETTE.coin;
    context.lineWidth = 3;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, PALETTE.text, 'center', 'bold');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, '#c9cdd6', 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 22, PALETTE.coin, 'center');
  }

  const TITLE_LINES = [
    'Take orders, boil noodles, ladle broth,',
    'add toppings, fry snacks — and serve before',
    'patience runs out. Tips grow with speed!',
    '',
    'Move with ← → or A D, or click a station.',
    'Space interacts. 1-3 broth, 4-8 toppings, G/K fryer, S serve.',
  ];

  /** Paint one frame: the shop, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawWall(state);
    drawTickets(state);
    drawCustomers(state);
    drawStations(state);
    drawChef(state);
    drawHelp();
    if (screen === SCREEN_TITLE) {
      const lines = TITLE_LINES.slice();
      lines[3] = best > 0 ? bestLabel(best) : 'Best shift yet: yours to set.';
      drawPanel('RAMEN RUSH', lines, 'Press Space or click to open the shop');
      return;
    }
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The noodles will wait for you.'], 'Press P to get cooking again');
      return;
    }
    if (screen === SCREEN_OVER) {
      const lines = [
        finalLabel(state.dayCoins),
        servedLabel(state.served),
        lostLabel(state.lost),
        `Best combo x${state.bestCombo}`,
        totalLabel(state.coins),
        best > 0 ? bestLabel(best) : '',
      ];
      drawPanel(`Day ${state.day} complete!`, lines, 'Space: next day   •   R: start over');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, drawItem, drawDishIcon };
}
