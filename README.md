# Ant Colony

**Live: [gray0072.github.io/ants](https://gray0072.github.io/ants/)**

A real-time ant colony simulation game rendered on an HTML5 canvas. Manage workers, soldiers, and scouts to grow your colony and defend the queen against waves of beetles and spiders.

---

## Features

| Feature | Description |
|---------|-------------|
| Ant types | Queen, Worker, Soldier, Scout — each with autonomous AI |
| Fog of war | Map hidden until revealed by scout/worker movement |
| Pheromone trails | Workers leave trails; other workers prefer proven paths |
| Enemy waves | Beetles and spiders spawn at surface edges, escalating each wave |
| Colony growth | Dig chambers (+10 pop cap), expand surface, spawn ants |
| Win/loss | Win: 500 ants alive with no enemies; Lose: queen dies |

---

## How It Works

1. Workers forage for food on the surface and return it to the nest
2. Spend food to spawn ants (`W`/`S`/`E`), dig chambers (`D`), or expand surface (`F`)
3. Soldiers patrol and engage enemies automatically
4. Scouts reveal the fog of war, unlocking more surface to exploit

---

## Player Actions

| Key | Action | Cost |
|-----|--------|------|
| `W` | Spawn Worker | 15 food |
| `S` | Spawn Soldier | 20 food |
| `E` | Spawn Scout | 12 food |
| `D` | Dig Chamber | 30 food (+10 pop cap) |
| `F` | Expand Surface | 50 food |

---

## Tech Stack

- [TypeScript](https://www.typescriptlang.org/) — game logic and type safety
- [Vite](https://vitejs.dev/) — dev server and bundler
- [Canvas 2D API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) — rendering
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
├── ts/
│   ├── config.ts      — numeric constants
│   ├── state.ts       — mutable game state
│   ├── map.ts         — map gen, BFS, fog, food
│   ├── ant.ts         — ant FSM and pheromone deposit
│   ├── pheromone.ts   — decay loop
│   ├── enemy.ts       — wave spawning and chase AI
│   ├── colony.ts      — spawn, dig, upkeep, win check
│   ├── renderer.ts    — canvas rendering
│   ├── ui.ts          — HUD, keyboard, modal
│   ├── main.ts        — 60 UPS game loop
│   └── ants/
│       ├── queen.ts
│       ├── nurse.ts
│       ├── worker.ts
│       ├── soldier.ts
│       └── scout.ts
```

---

## Roadmap

- [ ] Nurse ant type (heals nearby ants)
- [ ] Multiple enemy factions with different behaviors
- [ ] Save / load colony state
- [ ] Mobile touch controls
- [ ] Sound effects

---

## License

MIT
