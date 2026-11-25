# Ramen Rush — Tokyo Noodle Bar

A complete, original cooking game that plays offline in a desktop browser from its
own static files. Run a tiny Tokyo ramen bar through a 150-second dinner shift:
take orders from the board, boil noodles, ladle broth, add toppings, fry gyoza and
karaage, pour green tea, and serve every customer before their patience runs out.

## How to play

- **Move** with ← → or A / D, or click a station (the chef walks there) or the floor.
- **Space / E** interacts with the station the chef stands at: start the noodle pot,
  take finished noodles, start the fryer, pour tea, place a finished dish on the
  serve pass or pick one up again.
- **1 / 2 / 3** pour shoyu, miso or tonkotsu broth into the bowl you carry
  (or click a ladle).
- **4 – 8** add egg, chashu, nori, negi or corn (or click a topping bin).
- **G / K** start gyoza / karaage in the fryer (or click a basket).
- **S** serves the first customer whose order your hands or the pass can fill;
  clicking a customer serves them directly.
- **X** tosses what you carry into the bin (a dish nobody ordered).
- **P** pauses, **M** mutes, **R** restarts from day 1 on the results screen.

## The menu

- **Shoyu Ramen** — noodles + shoyu broth + egg + nori (320 coins)
- **Miso Ramen** — noodles + miso broth + corn + negi (320 coins)
- **Tonkotsu Ramen** — noodles + tonkotsu broth + chashu + negi (340 coins)
- **Gyoza (6 pc)** — from the fryer (180 coins)
- **Karaage** — from the fryer (200 coins)
- **Green Tea** — from the tap (90 coins)

Tips grow with the patience left on the order, and serving dish after dish without
a mistake builds a combo multiplier (up to x2). Burnt noodles or fried food must be
tossed. A customer who waits too long walks out and costs 50 coins. Finish the
shift, then keep going: each new day brings customers faster and with less patience.

## Running it

Serve `game/` with any static server (for example `node serve.mjs`, then open
http://localhost:8080) and play in desktop Chrome. No network requests, no build
step, no libraries — the game is plain HTML, CSS and ES modules, with sounds
synthesised in Web Audio.

Screenshots are staged from the game's own code: `game/src/shots.js` plays the real
rules forward with a simple autopilot behind `?shot=start|play|serve|end&seed=N`.

## Entry

Built for the make.fun competition "Make the best cooking game"
(best-cooking-game-20261125-0137). `main.ts` hands the game in: it copies `game/`
and `screenshots/` to `/output` and writes `dossier.json` with the vendored
`vendor/makefun-game.ts`. Run it with `MAKEFUN_OUTPUT_DIR=out node main.ts`.
