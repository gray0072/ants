# Ant Colony — Game Rules & Logic

## Stack

| Tool | Version | Role |
|------|---------|------|
| TypeScript | ^6.0.2 | Game logic and type safety |
| Vite | ^5.0.0 | Dev server, bundler |
| PixiJS | ^8.0.0 | WebGL renderer (map, ants, fog) |
| SolidJS | ^1.0.0 | Reactive UI (HUD, modals, bench panel) |
| gh-pages | ^6.0.0 | Deploy to GitHub Pages |

---

## Architecture

### Single mutable STATE

All runtime game data lives in one global `STATE` object (`ts/state.ts`). Game modules read and write it directly — no immutability, no copying. This keeps the hot path allocation-free and avoids per-frame GC pressure.

### Fixed-step game loop

`main.ts` drives everything with a single `requestAnimationFrame` loop:

```
accumulator += deltaMs * speedMultiplier
while accumulator >= FIXED_STEP (1000/UPS):
    tick all modules
    accumulator -= FIXED_STEP
render
```

`UPS = 60`. Speed multiplier (1×/2×/4×/8×) scales the accumulator, not the real elapsed time, so the simulation stays deterministic regardless of display refresh rate.

### SolidJS UI as a reactive mirror of STATE

The UI never reads `STATE` directly. Instead, `UIModule.update()` is called once per frame and copies relevant `STATE` fields into a SolidJS store (`ts/ui/store.ts`). SolidJS re-renders only the components whose store slices actually changed.

**Critical invariant**: auto-action flags (`autoSpawn`, `autoBuild`, `autoAction`) exist in **both** `STATE` (read by game logic) and `store` (read by UI). They must always be toggled via the dedicated `toggleAutoSpawn` / `toggleAutoBuild` / `toggleAutoAction` functions in `store.ts`, which update both in one call. Calling `setStore(...)` directly only updates the UI — the game logic keeps the old value.

### Stateless modules

`ColonyModule`, `AntModule`, `EnemyModule`, `MapModule`, `FogModule` hold no instance state. They are plain objects whose methods operate exclusively on `STATE`. This makes the call order in the game loop explicit and the modules individually testable.

### PixiJS renderer with sprite pools

`ts/render/entities.ts` maintains three growing arrays (`_antPool`, `_stagePool`, `_enmPool`). Each frame, sprites are assigned from the front of the pool; excess sprites are hidden. Sprites are never destroyed — the pool only grows. Ant textures (type × 3 animation frames) are pre-baked once at init via `bakeTexture` into off-screen render targets.

**Important**: `Renderer.init()` must be called exactly once (by `GameMain`). The bench reuses the same Pixi Application — calling `init()` a second time would recreate all containers while leaving pool sprites attached to the old (detached) ones, making all ants invisible.

### Bench mode

The bench panel replaces the header area but leaves the canvas and HUD in place. Starting a render bench (`startRenderBench`) runs its own RAF loop that mirrors `GameMain.loop()` exactly — same fixed-step accumulator, same module call order — but adds `keepAlive()` (prevents queen death / STATE.over) and `STATE.food = 999_999` each tick. `STATE.survival = true` is set at bench setup so flight completion never triggers a modal.

Exiting the bench without running any test resumes the game at speed 1 (`resumeGame()`). Exiting after a test restarts the game (`restartGame()`), which replays the intro and shows the difficulty modal.

### Pathfinding hierarchy

Three strategies, chosen by zone (see [Pathfinding](#pathfinding) section).

---

## State

The single mutable game state lives in `ts/state.ts`. Key fields:

```ts
GameState {
  // Flow
  running: boolean
  over: boolean
  won: boolean
  survival: boolean         // true after "Continue (Survival)" or in bench mode
  tick: number
  wave: number

  // Colony
  food: number
  chambers: number
  surfaceRows: number

  // Auto-action flags (mirrored to SolidJS store — use toggle* functions to update)
  autoSpawn: Record<AntType, boolean>
  autoBuild: { chamber: boolean; expand: boolean }
  autoAction: { flight: boolean }

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
- **Surface depth** starts at 3 rows and can be expanded (see Build).
- **Nest** is always `NEST_DEPTH` (5) cells below the surface bottom. As surface expands, nest slides deeper.
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
- Can only be ordered once all chambers are dug **and** surface is fully expanded. Limit: `PRINCESS_LIMIT` adult princesses (difficulty-dependent: 20 / 25 / 30).
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
- **Population cap** = `chambers × ANTS_PER_CHAMBER` (20 per chamber).

---

## Enemies

Spawn in waves on the surface edges every ~900 ticks. Each wave is slightly larger than the last (×1.05).

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
| `Q` | Spawn Princess | 100 food | New princess (all chambers + max surface required) |
| `R` | Dig Chamber | 30+5n food | +20 population cap; new chamber carved near nest |
| `F` | Expand Surface | 50+10n food | Surface +1 row (max 30); nest slides 1 deeper; new food spawns |
| `A` | Start Flight | — | Begins princess mating flight (all prerequisites met) |

Hold **Shift** + key to toggle the corresponding auto-action (highlighted button = active).

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
3. Surface rows = `SURFACE_ROWS_MAX` (30).
4. Adult princesses ≥ `PRINCESS_LIMIT` (difficulty-dependent: 20 / 25 / 30).

When all four are met, the **Start Flight** button (`A`) becomes active.

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
                QHW starts at 1 and grows by 1 each time a new floor is unlocked
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

---

## Bench Mode

The bench panel replaces the page header (canvas and HUD remain). It is opened via the **Bench** button in the HUD footer, which also pauses the game.

### Scenario options

| Field | Range | Description |
|-------|-------|-------------|
| Workers / Soldiers / Scouts | 0–2000 | Initial adult ant counts |
| Nurses | 0–`CHAMBER_FLOORS × CHAMBERS_PER_FLOOR` | Initial nurse count |
| Princesses | 0–`PRINCESS_LIMIT` | Initial princess count |
| Enemies | 0–2000 | Enemies placed randomly on the surface |
| All chambers | ☐ | Dig all possible chambers before starting |
| Full surface | ☐ | Expand surface to max before starting |

### Measure options

| Option | Description |
|--------|-------------|
| Update (logic) | Benchmark `AntModule` + `EnemyModule` + `ColonyModule` per tick |
| Render | Benchmark `Renderer.render()` per frame |
| Reveal map | Fill fog array to 1 (all cells visible) before starting |

When **Update** only: runs 1000 ticks synchronously (blocking), prints percentile table.
When **Render** is checked: starts a live RAF loop mirroring the main game loop. Speed buttons and pause work normally during the live bench.

**Exit behaviour**: closing the bench without running any test resumes the existing game at speed 1. Closing after running a test restarts the game (shows difficulty modal).

### Bench vs. normal game startup

| | Normal game | Bench |
|---|---|---|
| `STATE.reset()` + `STATS.reset()` + `MapModule.init()` | `restart()` | `setup()` |
| `ColonyModule.init()` (queen + starting ants) | `startGame()` | `setup()` |
| Difficulty (`applyDifficulty`) | yes | no — uses current CONFIG |
| Fog | partial reveal (nest + tunnel path) | fill 1 or leave 0 |
| Intro animation + modal | yes | no |
| Ant counts | starting values only | user-defined parameters |
| `autoSpawn` | all false | all true |
| Enemy wave spawning | normal interval | disabled (`nextEnemySpawn = MAX_SAFE_INTEGER`) |
| `STATE.survival` | false | always true (prevents game-over modal) |
| Cached STATE fields (`canDigChamber` etc.) | updated on first `ColonyModule.update()` tick | set explicitly at end of `setup()` |
| HUD sync (`store.update()`) | called every frame by game loop | called once after `setup()` by `startRenderBench` |

Shared helpers used by both bench and `PERF_DEBUG` mode: `MapModule.expandSurfaceFull()`, `ColonyModule.digAllChambers()`.

---

## File Structure

```
/
├── index.html              — canvas + app mount point
├── style.css               — dark theme, buttons, modals, bench panel
├── tsconfig.json           — TypeScript configuration
└── ts/
    ├── config.ts           — all numeric constants
    ├── state.ts            — single mutable game state + popCap/chamberCost helpers
    ├── stats.ts            — session statistics (reset on restart)
    ├── i18n.ts             — EN / RU translation strings and helpers
    ├── difficulty.ts       — difficulty presets (easy / medium / hard)
    ├── map.ts              — map gen, BFS pathfinding, flow field, food, surface expand
    ├── fog.ts              — fog reveal, shrink over time
    ├── ant.ts              — createAnt(), updateFlightGuardStates(), FSM dispatch
    ├── enemy.ts            — wave spawning, chase/attack AI, kill tracking
    ├── colony.ts           — orderAnt(), digChamber(), upkeep tick, auto-actions, flight check
    ├── intro.ts            — intro animation controller
    ├── main.ts             — fixed-step game loop (60 UPS), speed control, restart, survival
    ├── render/
    │   ├── index.ts        — Renderer.init() / render() entry point
    │   ├── constants.ts    — pixel sizes, colors
    │   ├── builders.ts     — procedural sprite/shape builders
    │   ├── entities.ts     — ant + enemy sprite pools, per-frame update
    │   ├── map.ts          — terrain pixel buffer update
    │   ├── overlay.ts      — food dots, fog overlay, HP bars
    │   └── intro.ts        — intro queen animation
    ├── ants/
    │   ├── queen.ts        — idle / layEgg / returnToThrone
    │   ├── nurse.ts        — fetchEgg / waitInChamber
    │   ├── worker.ts       — forage / return / flee / ring-guard states
    │   ├── soldier.ts      — patrol / chase / ring-guard states
    │   ├── scout.ts        — scout (fog reveal)
    │   └── princess.ts     — wander / surface / prepare / fly
    ├── ui/
    │   ├── index.tsx       — UIModule: SolidJS mount, keyboard hotkeys
    │   ├── store.ts        — SolidJS store (reactive mirror of STATE), game callbacks
    │   ├── App.tsx         — root component: Header / BenchPanel, HUD, modals
    │   └── BenchPanel.tsx  — bench configuration and controls
    └── bench/
        ├── bench.ts        — BenchOptions, setup(), keepAlive(), runUpdateBench()
        └── bench-render.ts — startRenderBench(): live RAF bench loop
```
