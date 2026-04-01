// NOTE: CONFIG is intentionally mutable — applyDifficulty() overrides
// START_FOOD, PRINCESS_LIMIT, and ENEMY_WAVE_SCALE at runtime.
export const CONFIG = {
    // Timing
    UPS: 60,

    // Debug switch: open full surface, dig all chambers, add ants and money.
    PERF_DEBUG: false,
    // Debug switch: start with unlimited food (999 999).
    FOOD_DEBUG: false,

    // Map
    COLS: 80,
    ROWS: 60,
    CELL: 12,
    SURFACE_ROWS_START: 3,
    SURFACE_ROWS_MAX: 30,
    SURFACE_EXPAND_COST_BASE: 50,
    SURFACE_EXPAND_COST_STEP: 10,
    NEST_DEPTH: 5,

    // Nest layout (chambers)
    QUEEN_CHAMBER_HALF_W_INIT: 1,
    QUEEN_CHAMBER_HALF_W_STEP: 1,
    QUEEN_CHAMBER_HALF_H: 1,
    CHAMBER_RADIUS: 1,
    CHAMBER_STEP: 8,
    CHAMBER_FLOOR_STEP: 8,
    CHAMBER_VOFFSET: 3,
    CHAMBERS_PER_FLOOR: 8,
    CHAMBER_FLOORS: 3,

    // Colony start
    START_FOOD: 120,
    START_WORKERS: 3,
    START_SOLDIERS: 1,
    START_SCOUTS: 1,
    START_CHAMBERS: 1,

    // Costs (food)
    COST_WORKER: 15,
    COST_SOLDIER: 20,
    COST_SCOUT: 12,
    COST_PRINCESS: 100,
    COST_CHAMBER_BASE: 30,
    COST_CHAMBER_STEP: 5,

    // Soldier ring (flight guard)
    SOLDIER_RING_RADIUS_MIN: 16,
    SOLDIER_RING_RADIUS_MAX: 20,
    WORKER_RING_RADIUS_MIN: 12,
    WORKER_RING_RADIUS_MAX: 16,
    FLIGHT_GUARD_CHASE_RADIUS: 5,  // max distance from ring spot to pursue an enemy

    // Princess
    PRINCESS_EXIT_RADIUS: 10,        // radius of upper-semicircle scatter on flight start (cells)
    PRINCESS_SURFACE_LINGER: 180,   // ticks on surface before liftoff (~3s)
    PRINCESS_HP: 80,
    PRINCESS_SPEED: 0.05,
    PRINCESS_REVEAL_RADIUS: 3,
    PRINCESS_LIMIT: 30,

    // Population
    ANTS_PER_CHAMBER: 20,
    WIN_POPULATION: 500,
    GOAL_CHAMBERS: 25,

    // Queen & upkeep
    QUEEN_HP: 200,
    QUEEN_SPEED: 0.04,
    QUEEN_REVEAL_RADIUS: 3,

    // Nurse
    NURSE_HP: 20,
    NURSE_SPEED: 0.07,
    NURSE_REVEAL_RADIUS: 2,
    COST_NURSE: 10,
    COLONY_UPKEEP_INTERVAL: 300,
    COLONY_UPKEEP_PER_ANT: 0.05,

    // Ants (stats, lifecycle, vision)
    WORKER_HP: 25,
    SOLDIER_HP: 60,
    SCOUT_HP: 15,
    WORKER_SPEED: 0.06,
    SOLDIER_SPEED: 0.08,
    SCOUT_SPEED: 0.10,
    WORKER_REVEAL_RADIUS: 3,
    SOLDIER_REVEAL_RADIUS: 3,
    SCOUT_REVEAL_RADIUS: 6,
    EGG_TICKS: 360,
    LARVA_TICKS: 600,
    PUPA_TICKS: 480,

    // Combat
    WORKER_DAMAGE: 3,
    WORKER_ATTACK_RANGE: 1.5,
    WORKER_ATTACK_COOLDOWN: 60,
    WORKER_FLEE_RADIUS: 4,
    WORKER_FLEE_CLEAR: 5,
    SOLDIER_DAMAGE: 10,
    SOLDIER_ATTACK_RANGE: 1.5,
    SOLDIER_ATTACK_COOLDOWN: 35,
    QUEEN_DAMAGE: 5,
    QUEEN_ATTACK_RANGE: 1.5,
    QUEEN_ATTACK_COOLDOWN: 50,

    // Fog of war
    FOG_SHRINK_INTERVAL: 10,   // ticks between fade steps
    FOG_FADE_TICKS: 1200,       // ticks to go from fully visible to hidden (5 sec at 60 UPS)
    FOG_EDGE_VISIBILITY: 0.5,  // visibility of the outermost reveal ring

    // Food
    FOOD_AMOUNT: 20,
    FOOD_PER_SURFACE_ROW: 8,
    FOOD_MAX: 40,
    FOOD_REGEN_INTERVAL: 240,
    FOOD_REGEN_PER_SURFACE_ROW: 0.4,
    FOOD_REGEN_AMOUNT: 8,
    CARRY_AMOUNT: 5,
    WORKER_DEPOSIT_RANGE: 1,

    // Enemies
    ENEMY_SPAWN_INTERVAL: 900,
    ENEMY_SPAWN_COUNT: 2,
    ENEMY_WAVE_SCALE: 1.05,
    ENEMY_MAX: 400,
    ENEMY_ATTACK_RANGE: 1.5,
    BEETLE_HP: 20,
    BEETLE_DAMAGE: 3,
    BEETLE_SPEED: 0.04,
    BEETLE_ATTACK_COOLDOWN: 70,
    SPIDER_HP: 30,
    SPIDER_DAMAGE: 6,
    SPIDER_SPEED: 0.055,
    SPIDER_ATTACK_COOLDOWN: 80,
};