# Ant Colony

**Live: [gray0072.github.io/ants](https://gray0072.github.io/ants/)**

A real-time ant colony simulation game rendered on an HTML5 canvas. Grow your colony underground, raise an army of princesses, and launch the mating flight to win.

---

## Features

| Feature | Description |
|---------|-------------|
| Ant types | Queen, Worker, Soldier, Scout, Nurse, Princess — each with autonomous AI |
| Fog of war | Map hidden until revealed by movement |
| Enemy waves | Beetles and spiders spawn at surface edges, escalating each wave |
| Colony growth | Dig chambers, expand surface, spawn ants |
| Princess flight | Launch a mating flight — soldiers and workers form a defense ring |
| Survival mode | Continue after victory; repeat flights earn gold stars |
| Difficulty | Easy / Medium / Hard — affects starting food and princess limit |
| Stats | Peak population, food gathered, enemies killed, princesses flown, and more |

---

## How to Win

1. Dig **25 chambers** underground
2. Raise **20–30 princesses** (depends on difficulty)
3. Press **`A`** to launch the princess flight
4. Defend until all princesses escape the map

After winning you can continue in **Survival mode** and repeat flights for stars (★).

---

## Player Actions

| Key | Shift+Click | Action | Cost |
|-----|-------------|--------|------|
| `W` | auto-spawn | Spawn Worker | 15 food |
| `S` | auto-spawn | Spawn Soldier | 20 food |
| `E` | auto-spawn | Spawn Scout | 12 food |
| `D` | auto-spawn | Spawn Nurse | 10 food |
| `Q` | auto-spawn | Spawn Princess | 100 food |
| `R` | auto-dig | Dig Chamber | scales |
| `F` | auto-expand | Expand Surface | scales |
| `A` | — | Start Flight | — |
| `Space` | — | Pause / Resume | — |
| `1`–`4` | — | Set speed ×1 / ×2 / ×4 / ×8 | — |

---

## Tech Stack

- [TypeScript](https://www.typescriptlang.org/) — game logic and type safety
- [Vite](https://vitejs.dev/) — dev server and bundler
- [PixiJS](https://pixijs.com/) — WebGL renderer (map, fog, ants, enemies)
- [gh-pages](https://github.com/tschaub/gh-pages) — GitHub Pages deployment

---

## Getting Started

```bash
git clone https://github.com/gray0072/ants.git
cd ants
npm install
npm run dev
```

---

## Build & Deploy

```bash
npm run build    # builds to ./dist
npm run deploy   # builds + pushes to gh-pages branch
```

> `vite.config.ts` sets `base: '/ants/'` for correct asset paths on GitHub Pages.

---

## Project Structure

```
/
├── index.html
├── style.css
└── ts/
    ├── config.ts       — numeric constants
    ├── state.ts        — mutable game state
    ├── stats.ts        — session statistics (food, kills, ants, etc.)
    ├── i18n.ts         — EN / RU translations
    ├── difficulty.ts   — difficulty presets
    ├── map.ts          — map gen, BFS, fog, food
    ├── ant.ts          — ant FSM, flight guard logic
    ├── enemy.ts        — wave spawning and chase AI
    ├── colony.ts       — spawn orders, dig chambers, upkeep, flight completion
    ├── ui.ts           — HUD, keyboard hotkeys, modals
    ├── main.ts         — 60 UPS fixed-timestep game loop
    ├── render/         — Canvas 2D renderer (map, fog, ants, enemies)
    └── ants/
        ├── queen.ts
        ├── nurse.ts
        ├── worker.ts
        ├── soldier.ts
        ├── scout.ts
        └── princess.ts
```

---

## License

MIT
