// Ramen Rush — Tokyo Noodle Bar: every tuning number, recipe and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the window,
// so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Length of one dinner shift, in seconds. */
export const SHIFT_SECONDS = 150;

export const CHEF = { speed: 540, y: 600, width: 56, height: 92 };

/** Stations along the kitchen counter, left to right. x is the zone's left edge. */
export const STATIONS = [
  { id: 'pot', label: 'Noodle Pot', x: 40, width: 200 },
  { id: 'broth', label: 'Broth', x: 260, width: 200 },
  { id: 'toppings', label: 'Toppings', x: 480, width: 200 },
  { id: 'fryer', label: 'Fryer', x: 700, width: 200 },
  { id: 'tea', label: 'Green Tea', x: 920, width: 120 },
  { id: 'pass', label: 'Serve Pass', x: 1060, width: 180 },
];

/** Noodles: seconds to cook, seconds after that before they burn. */
export const POT = { cook: 3.0, burn: 6.5 };
/** Fryer baskets: seconds to fry, seconds after that before they burn. */
export const FRYER = { cook: 4.0, burn: 8.0 };

/** Broths, in ladle order. */
export const BROTHS = [
  { id: 'shoyu', name: 'Shoyu', color: '#8a5a2b', light: '#c98d4b' },
  { id: 'miso', name: 'Miso', color: '#a8642e', light: '#d99a55' },
  { id: 'tonkotsu', name: 'Tonkotsu', color: '#e8d9b0', light: '#f4e8c8' },
];

/** Topping bins, in bin order. */
export const TOPPINGS = [
  { id: 'egg', name: 'Egg', color: '#fff3d6', yolk: '#f2a93b' },
  { id: 'chashu', name: 'Chashu', color: '#e8a0a0', rim: '#c96a6a' },
  { id: 'nori', name: 'Nori', color: '#2e4d2e', rim: '#1d331d' },
  { id: 'negi', name: 'Negi', color: '#7dc383', rim: '#4d8a52' },
  { id: 'corn', name: 'Corn', color: '#f2d13d', rim: '#d9a91f' },
];

/** The menu: every dish a customer can order. */
export const DISHES = {
  shoyu: { name: 'Shoyu Ramen', kind: 'ramen', broth: 'shoyu', toppings: ['egg', 'nori'], price: 320, icon: 'ramen' },
  miso: { name: 'Miso Ramen', kind: 'ramen', broth: 'miso', toppings: ['corn', 'negi'], price: 320, icon: 'ramen' },
  tonkotsu: { name: 'Tonkotsu Ramen', kind: 'ramen', broth: 'tonkotsu', toppings: ['chashu', 'negi'], price: 340, icon: 'ramen' },
  gyoza: { name: 'Gyoza (6 pc)', kind: 'fryer', fry: 'gyoza', price: 180, icon: 'gyoza' },
  karaage: { name: 'Karaage', kind: 'fryer', fry: 'karaage', price: 200, icon: 'karaage' },
  tea: { name: 'Green Tea', kind: 'tea', price: 90, icon: 'tea' },
};

/** Weighted pick table for new orders: ramen is the house star, snacks and tea fill in. */
export const ORDER_TABLE = [
  ['shoyu', 3], ['miso', 3], ['tonkotsu', 2],
  ['gyoza', 2], ['karaage', 2], ['tea', 1],
];

/** Customers: seats at the eating counter (top of the kitchen). */
export const SEATS = [
  { x: 300, y: 218 },
  { x: 640, y: 218 },
  { x: 980, y: 218 },
];

/** Patience a customer arrives with, and how fast new ones show up per day. */
export const CUSTOMER = { patience: 52, spawnFirst: 9, spawnBase: 15, spawnMin: 8, patienceShrink: 0.92 };

/** Coins lost when a customer storms out, and the tip curve. */
export const ECONOMY = { walkoutPenalty: 50, tipMax: 0.5, comboStep: 0.1, comboMax: 2.0 };

export const PALETTE = {
  backdrop: '#171009',
  wall: '#33200f',
  wallTrim: '#4a2c14',
  lantern: '#d63c2f',
  lanternGlow: '#ff7a5c',
  board: '#3a2412',
  boardEdge: '#6b4423',
  ticket: '#fdf3d8',
  ticketInk: '#3a2412',
  counter: '#7a4a22',
  counterTop: '#a06835',
  counterEdge: '#5d3617',
  floor: '#2f1e0b',
  steel: '#9aa3ad',
  steelDark: '#6d757f',
  pot: '#3f4a55',
  brothPot: '#8a5a2b',
  fryerOil: '#e8a83d',
  teaGreen: '#7ba05b',
  text: '#fdf3d8',
  muted: '#c9a582',
  coin: '#f2c94c',
  good: '#7dc383',
  bad: '#e5534b',
  chefHat: '#f5f0e6',
  chefCoat: '#f5f0e6',
  chefSkin: '#f2c49b',
  chefApron: '#2f5d8a',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** Where the best total is kept between visits (this browser only). */
export const BEST_KEY = 'ramen-rush.best';
