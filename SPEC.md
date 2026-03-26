# Ant Colony — Game Rules & Logic

## Stack

| Tool | Version | Role |
|------|---------|------|
| TypeScript | ^6.0.2 | Game logic and type safety |
| Vite | ^5.0.0 | Dev server, bundler |
| PixiJS | ^8.0.0 | WebGL renderer (map, ants, fog) |
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
  // Flow
  running: boolean
  over: boolean
  won: boolean
  survival: boolean         // true after "Continue (Survival)" clicked
  tick: number
  wave: number

  // Colony
  food: number
  chambers: number
  surfaceRows: number
  queenHp: number

  // Entities
  ants: Ant[]
  enemies: Enemy[]

  // Grids (flat typed arrays, size COLS × ROWS)
  map: CellType[]
  foodGrid: Float32Array
  fog: Float32Array

  // Flight
  flightStarted: boolean
  flightTotal: number       // adult princesses counted at flight start
  flightEscaped: number     // incremented each time a princess exits the map
  completedFlights: number  // total flights finished (shown as ★)
}
```

Session statistics (reset on restart) live in `ts/stats.ts`:

```ts
STATS {
  maxAnts: number           // peak STATE.ants.length in one tick
  totalAntsProduced: number // ants that hatched from pupa
  totalFoodCollected: number
  totalEnemiesKilled: number
  totalPrincessesFled: number
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
- **Flees** to the queen if an enemy appears within radius 4. Resumes foraging when threat is gone (> 5 cells away).

### Soldier (red) — `S`
- **Patrols** near nest on passable cells.
- **Chases** any visible enemy on the map (fog-revealed). Attacks when within range 1.5.
- Does not gather food.

### Scout (yellow) — `E`
- Moves toward unrevealed passable cells to remove fog of war.
- Largest reveal radius (6 cells).

### Princess (pink) — `Q`
- Spawned like other ants via the egg queue. Can only be ordered once all chambers are dug (max chambers reached). Limit: `PRINCESS_LIMIT` adult princesses (difficulty-dependent: 20 / 25 / 30).
- **wander** — roams between lower chambers underground. On `flightStarted` transitions to `surface`.
- **surface** — pathfinds to a random surface exit point near the nest. Has a random stagger delay (0–120 ticks) to spread out departure times.
- **prepare** — mills around on the surface for ~3 s (180 ticks) before liftoff.
- **fly** — executes a spiral trajectory outward and upward using a golden-angle offset per princess. When `row < −3`, she escapes the map: `flightEscaped++`, `hp = 0` (removed next tick).

### Nurse (blue) — `D`
- Fetches eggs/larvae/pupae from the queen chamber and carries them to an assigned chamber.
- Waits in the chamber until the carried ant hatches, then returns for another.
- At most one nurse per chamber (except the queen chamber).

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

## Player Actions

| Key | Button | Cost | Effect |
|-----|--------|------|--------|
| `W` | Spawn Worker | 15 food | New worker ant at nest |
| `S` | Spawn Soldier | 20 food | New soldier ant at nest |
| `E` | Spawn Scout | 12 food | New scout ant at nest |
| `D` | Spawn Nurse | 10 food | New nurse ant at nest |
| `Q` | Spawn Princess | 100 food | New princess ant at nest (max chambers required) |
| `R` | Dig Chamber | 30 food | +10 population cap; new chamber carved near nest |
| `F` | Expand Surface | 50 food | Surface +1 row (max 30); nest slides 1 deeper; new food spawns on new row |
| `A` | Start Flight | — | Begins princess mating flight (all prerequisites met) |

---

## Food

- Placed only on surface.
- Sources proportional to surface size: **8 × surfaceRows** sources.
- Regenerates every 240 ticks: **max(1, round(0.4 × surfaceRows))** random surface cells get +8 food (capped at 40 per cell).

---

## Win / Loss

- **Win**: all princesses escape the map after the flight is started (see [Princess Flight](#princess-flight)).
- **Loss**: queen HP reaches 0.

---

## Princess Flight

### Prerequisites (goals)

1. Queen alive.
2. Chambers ≥ `GOAL_CHAMBERS` (25).
3. Adult princesses ≥ `PRINCESS_LIMIT` (difficulty-dependent).

When all three are met, the **Start Flight** button (`A`) becomes active.

### Starting the flight

Pressing `A` / clicking the button sets `STATE.flightStarted = true` and records `flightTotal` = number of adult princesses at that moment. All princesses begin their surface→prepare→fly sequence with staggered delays.

### During flight

- Soldiers and workers enter **ring guard** mode via `updateFlightGuardStates()` (called first in each ant's update). Each ant is assigned a random position in a semicircle of radius 12–18 cells above the nest exit.
  - **surface** — moves to assigned ring position; attacks enemies within `FLIGHT_GUARD_CHASE_RADIUS` on the way.
  - **fly** — holds position, rotates outward; switches to `chase` if an enemy is within `FLIGHT_GUARD_CHASE_RADIUS` (10).
  - **chase** — pursues an enemy; returns to ring position (`surface`) if it strays too far or the enemy disappears.
- Progress shown as `flightEscaped / flightTotal` in the HUD.

### Flight completion

When `flightEscaped >= flightTotal`:

- `completedFlights++` — a gold star `★` appears at the bottom of the Goals panel. Every 10 small stars collapse into one large star.
- `flightStarted = false`, `flightEscaped = 0`, `flightTotal = 0` — counters reset.
- **Normal mode**: game ends with a victory screen (with full session stats).
- **Survival mode**: game continues; `updateFlightGuardStates` detects `!flightStarted` and automatically releases all ants from `surface`/`fly` back to `patrol`/`forage`/`return` on the next tick.

---

## Survival Mode

After the first victory screen the player can click **Continue (Survival)** instead of restarting.

### Activation

- `STATE.survival = true`, `STATE.over = false`.
- The game loop resumes. Ants in `surface`/`fly` guard states are released automatically by the state machine on the next tick (no manual reset needed).

### Behaviour in survival mode

- Ring-guard logic works **identically** to the first flight — soldiers and workers form a ring for every subsequent flight.
- After each flight ends, `flightStarted = false` triggers the auto-release: `updateFlightGuardStates` resets any ant still in `surface` or `fly` to its normal state and returns `false`, handing control back to the regular AI.
- Subsequent flights follow the same prerequisites. Once the player raises a new batch of `PRINCESS_LIMIT` adult princesses they can press `A` again.
- Each completed flight adds one `★` star and resets flight counters; the game never ends automatically.
- Loss condition remains: queen death → game over.

---

## Colony Structure

### Grid layout

The world is a flat `COLS × ROWS` grid (default 80 × 60). Every cell has a type:

| Type | Passable | Description |
|------|----------|-------------|
| `surface` | yes | Open ground — top `surfaceRows` rows, all columns |
| `soil` | no | Solid earth — default for underground cells |
| `tunnel` | yes | Carved passage connecting chambers or reaching the surface |
| `chamber` | yes | Excavated room that houses ants and eggs |

**Surface zone** (`row < surfaceRows`) — fully open. All cells are `surface` type. Enemies spawn here; food spawns here; ants forage here. Ants and enemies on the surface move in a straight line to any surface target (no BFS needed).

**Underground zone** (`row >= surfaceRows`) — starts as solid `soil`. Carved cells become `tunnel` or `chamber`.

### Nest layout

On init the nest is placed at column `floor(COLS / 2)`, row `surfaceRows + NEST_DEPTH`.

```
row 0 ─────────────────── surface top
      (surfaceRows rows, all 'surface')
row surfaceRows ─────────── surface/underground boundary
      │
      │ main vertical tunnel at nestCol
      │ (carved from row 0 down to nestRow)
      │
row nestRow ─── queen chamber (2*QHW+1 × 2*QHH+1 'chamber' cells)
```

The **main tunnel** runs exactly on `nestCol` from row `0` down to `nestRow`. It is carved unconditionally so surface expansion never disconnects the nest.

### Chambers

Additional chambers are placed in a symmetric tree-like pattern relative to the nest:

- Chambers are laid out on **floors** below the nest. Each floor is offset by `CHAMBER_FLOOR_STEP` rows.
- On each floor, chambers alternate left/right at increasing column distances (`rank × CHAMBER_STEP`).
- Each chamber is connected to the main spine via an L-shaped tunnel: a horizontal run from the main column to `cc`, then a vertical drop to the chamber centre.

`STATE.chamberPositions[]` tracks every chamber centre. Population cap = `chambers × ANTS_PER_CHAMBER`.

### Surface expansion

`MapModule.expandSurface()` shifts the entire world down by one row (scrolls all grids, ant positions, enemy positions, chamber positions) and adds a new `surface` row at the top. `STATE.surfaceRows` increments by 1. The main tunnel remains unbroken because it was carved to row 0.

---

## Pathfinding

Three mechanisms are used depending on context.

### 1. BFS point-to-point (`MapModule.findPath`)

```ts
findPath(fc, fr, tc, tr, passableFn): [number, number][] | null
```

Standard 4-directional BFS using pre-allocated static buffers (`_bfsParent`, `_bfsQueue`) to avoid per-call allocations. Capped at 20 000 iterations.

**Path format** — the returned array is stored in reverse order:

```
path[0]           = target cell (consumed last)
path[1..n-2]      = intermediate steps
path[path.length-1] = first step adjacent to the ant (consumed first via pop())
```

`followPath(ant)` advances the ant by popping from the end each tick:

```ts
const [tc, tr] = ant.path[ant.path.length - 1];
if (stepToward(ant, tc, tr)) ant.path.pop();
```

`requestPath(ant, tc, tr)` is a thin wrapper that calls `findPath` and stores the result.

### 2. Flow field (`STATE.nestFlowDir / nestFlowDist`)

Built once by `MapModule.buildNestFlow()` (and rebuilt on `nestFlowDirty`). BFS from the nest outward, storing for every passable cell:

- `nestFlowDir[i]` — 4-bit direction index pointing **toward** the nest.
- `nestFlowDist[i]` — BFS distance from the nest.

Used by workers returning home and by enemies navigating toward the nest without individual BFS calls.

### 3. Smart routing (`requestPathSmart`)

Skips or shortens BFS based on zone:

| Ant location | Target location | Strategy |
|---|---|---|
| surface | surface | Direct: `path = [[tc, tr]]` — straight line, no BFS |
| underground | underground | Full BFS via `requestPath` |
| surface | underground | Full BFS via `requestPath` |
| underground | surface | **BFS to tunnel exit, then straight**: BFS from ant to `(nestCol, surfaceRows-1)`, then append `[tc, tr]` at `path[0]` so it is consumed last |

The tunnel exit is always `(STATE.nestCol, STATE.surfaceRows - 1)` — the topmost cell of the main vertical tunnel, which is on the surface boundary.

Path construction for the underground → surface case:

```ts
const bfsPath = findPath(antCol, antRow, nestCol, surfaceRows - 1, isPassable);
// bfsPath[0] = exit cell, bfsPath[last] = first step
ant.path = [[tc, tr], ...bfsPath];
// Execution: pop first step → ... → pop exit → pop [tc,tr] (straight to target)
```

---

## File Structure

```
/
├── index.html          — canvas + HUD overlay
├── style.css           — dark theme, buttons, legend, modals
├── tsconfig.json       — TypeScript configuration
└── ts/
    ├── config.ts       — all numeric constants with type definitions
    ├── state.ts        — single mutable game state (food, ants[], enemies[], grids, flight flags)
    ├── stats.ts        — session statistics (reset on restart)
    ├── i18n.ts         — EN / RU translation strings and helpers
    ├── difficulty.ts   — difficulty presets (easy / medium / hard) and apply logic
    ├── map.ts          — map gen, BFS pathfinding, food placement, fog, surface expand
    ├── ant.ts          — createAnt(), updateFlightGuardStates(), FSM dispatch
    ├── enemy.ts        — createEnemy(), wave spawning, chase/attack AI, kill tracking
    ├── colony.ts       — orderAnt(), digChamber(), upkeep tick, flight completion check
    ├── ui.ts           — HUD update, keyboard hotkeys, modals, auto-spawn, stars display
    ├── main.ts         — fixed-timestep game loop (60 UPS), restart, survival resume
    ├── render/
    │   ├── index.ts    — renderer entry point
    │   ├── constants.ts — render constants (colors, sizes)
    │   ├── builders.ts — sprite/shape builders
    │   ├── entities.ts — ants and enemies rendering
    │   ├── map.ts      — map and food rendering
    │   ├── overlay.ts  — fog of war overlay
    │   └── intro.ts    — intro screen rendering
    └── ants/
        ├── queen.ts    — idle / layEgg / returnToThrone
        ├── nurse.ts    — fetchEgg / waitInChamber
        ├── worker.ts   — forage / return / flee / ring-guard states
        ├── soldier.ts  — patrol / chase / ring-guard states
        ├── scout.ts    — scout (fog reveal)
        └── princess.ts — wander / surface / prepare / fly (escape tracking)
```
