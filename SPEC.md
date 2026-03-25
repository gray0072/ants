# Ant Colony — Game Rules & Logic

## Stack

| Tool | Version | Role |
|------|---------|------|
| TypeScript | ^6.0.2 | Game logic and type safety |
| Vite | ^5.0.0 | Dev server, bundler |
| Canvas 2D API | browser | Rendering (map, ants, fog, pheromones) |
| gh-pages | ^6.0.0 | Deploy to GitHub Pages |

No framework. Pure TypeScript with a canvas renderer.

---

## Overview

Ant Colony is a top-down real-time strategy/simulation game rendered on an HTML5 canvas. The player manages a colony of ants — workers, soldiers, scouts, and a queen — against waves of enemy insects. The goal is to grow the colony to 500 non-queen ants while keeping the queen alive.

---

## State

The single mutable game state lives in `ts/state.ts`. Key fields:

```ts
GameState {
  food: number
  ants: Ant[]
  enemies: Enemy[]
  ticks: number
  waveCount: number
  gameOver: boolean
  won: boolean
  map: MapCell[][]          // 80×60 grid
  fog: boolean[][]          // fog of war per cell
  pheromone: number[][]     // pheromone strength per cell
  surfaceRows: number       // current surface depth
  chambers: number          // number of dug chambers
  populationCap: number     // chambers × 10
}
```

---

## GitHub Pages Deployment

- `vite.config.ts` sets `base: '/ants/'`
- `npm run deploy` runs `predeploy` (build) then `gh-pages -d dist`
- GitHub Actions workflow at `.github/workflows/deploy.yml` auto-deploys on push to `main`
- Live URL: https://gray0072.github.io/ants/

---

## Map

- Top-down grid (80×60 cells). Top rows = **surface** (open ground). Below = **soil** (impassable) with carved **tunnels** and **chambers**.
- **Fog of war** — cells are hidden until revealed by scouts, workers, or soldiers moving near them.
- **Surface depth** starts at 2 rows and can be expanded (see Build).
- **Nest** is always 15 cells below the surface bottom. As surface expands, nest slides deeper.
- Main vertical tunnel connects nest to surface row 0. Always passable.

---

## Ants

All ants are drawn rotated in their movement direction (antennae forward).

### Queen (purple)
- Stationary. Sits in the queen chamber.
- If she dies → **Game Over**.

### Worker (tan) — `W`
- **Forages**: finds nearest visible food cell → paths to it → picks up food → returns to nest → deposits → repeat.
- Leaves **pheromone trails** on its path; other workers prefer cells with stronger trails.
- **Flees** to the queen if an enemy appears within radius 4. Resumes foraging when threat is gone (> 5 cells away).

### Soldier (red) — `S`
- **Patrols** near nest on passable cells.
- **Chases** any visible enemy on the map (fog-revealed). Attacks when within range 1.5.
- Does not gather food.

### Scout (yellow) — `E`
- Moves toward unrevealed passable cells to remove fog of war.
- Largest reveal radius (6 cells).

---

## Resources

- **Food** — collected by workers (5 per trip). Spent on ant spawning, digging, and surface expansion.
- **Colony upkeep** — every 300 ticks: −0.05 food × number of ants.
- **Population cap** = chambers × 10.

---

## Enemies

Spawn in waves on the surface edges every ~900 ticks. Each wave is slightly larger than the last (×1.1).

- **Beetle** (dark gray) — slower, less damage.
- **Spider** (dark red) — faster, more damage.

Enemy AI:
1. Find nearest ant (queen has ×4 distance penalty — targeted last).
2. If within 1.5 cells → attack.
3. Otherwise → path toward target.
4. If no ants found → move toward nest.

---

## Pheromones

- Workers deposit pheromone on every cell they walk through.
- Pheromone decays each tick. Heavily-used paths stay bright.
- `nearestFood` gives a bonus to cells with higher pheromone → workers naturally converge on proven routes.

---

## Player Actions

| Key | Button | Cost | Effect |
|-----|--------|------|--------|
| `W` | Spawn Worker | 15 food | New worker ant at nest |
| `S` | Spawn Soldier | 20 food | New soldier ant at nest |
| `E` | Spawn Scout | 12 food | New scout ant at nest |
| `D` | Dig Chamber | 30 food | +10 population cap; new chamber carved near nest |
| `F` | Expand Surface | 50 food | Surface +1 row (max 30); nest slides 1 deeper; new food spawns on new row |

---

## Food

- Placed only on surface.
- Sources proportional to surface size: **8 × surfaceRows** sources.
- Regenerates every 240 ticks: **max(1, round(0.4 × surfaceRows))** random surface cells get +8 food (capped at 40 per cell).

---

## Win / Loss

- **Win**: 500 non-queen ants alive simultaneously with no enemies on the map.
- **Loss**: queen HP reaches 0.

---

## File Structure

```
/
├── index.html       — canvas + HUD overlay
├── style.css        — dark theme, buttons, legend, modal
├── tsconfig.json    — TypeScript configuration
└── ts/
    ├── config.ts    — all numeric constants with type definitions
    ├── state.ts     — single mutable game state (food, ants[], enemies[], grids)
    ├── map.ts       — map gen, BFS pathfinding, food placement, fog, surface expand
    ├── ant.ts       — createAnt(), FSM update per type, pheromone deposit
    ├── pheromone.ts — decay loop
    ├── enemy.ts     — createEnemy(), wave spawning, chase/attack AI
    ├── colony.ts    — spawnAnt(), digChamber(), upkeep tick, win check
    ├── renderer.ts  — canvas 2D: map cells, pheromone overlay, fog, ants (rotated), enemies
    ├── ui.ts        — HUD update, keyboard hotkeys, modal
    ├── main.ts      — fixed-timestep game loop (60 UPS)
    └── ants/
        ├── queen.ts   — queen update logic
        ├── nurse.ts   — nurse update logic
        ├── worker.ts  — worker update logic
        ├── soldier.ts — soldier update logic
        └── scout.ts   — scout update logic
```
