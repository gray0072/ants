import { CONFIG } from './config';
import { FoodSpatialIndex } from './food-index';

// Type definitions
export type CellType = 'soil' | 'tunnel' | 'chamber' | 'surface';
export type AntType = 'worker' | 'soldier' | 'scout' | 'queen' | 'nurse' | 'princess';
export type Lifestage = 'egg' | 'larva' | 'pupa' | null;

// Per-ant-type state unions
export type WorkerState = 'forage' | 'return' | 'flee' | 'surface' | 'fly' | 'chase';
export type SoldierState = 'patrol' | 'chase' | 'surface' | 'fly';
export type ScoutState = 'scout';
export type QueenState = 'idle' | 'layEgg' | 'returnToThrone';
export type NurseState = 'fetchEgg' | 'waitInChamber';
export type PrincessState = 'wander' | 'surface' | 'prepare' | 'fly';
export type AntState = WorkerState | SoldierState | ScoutState | QueenState | NurseState | PrincessState;

export interface Mover {
    col: number;
    row: number;
    targetCol: number | null;
    targetRow: number | null;
    speed: number;
    angle: number;
    path: [number, number][];
}

export interface Attacker<T> {
    attackRange: number;
    damage: number;
    attackCooldown: number;
    baseCooldown: number;
    cachedTarget: T | null;
    cachedTargetTTL: number;
}

export interface Enemy extends Mover, Attacker<Ant> {
    type: 'beetle' | 'spider';
    hp: number;
    maxHp: number;
    wanderTimer: number;
}

interface AntBase extends Mover, Attacker<Enemy> {
    hp: number;
    maxHp: number;
    revealRadius: number;
    lifestage: Lifestage;
    lifestageTick: number;
    _carried: boolean;
    wanderTimer: number;
    _lastRevealIdx: number;
}

export interface WorkerAnt extends AntBase {
    type: 'worker';
    state: WorkerState;
    carriedFood: number;
}

export interface SoldierAnt extends AntBase {
    type: 'soldier';
    state: SoldierState;
}

export interface ScoutAnt extends AntBase {
    type: 'scout';
    state: ScoutState;
}

export interface QueenAnt extends AntBase {
    type: 'queen';
    state: QueenState;
    eggQueue: AntType[];
}

export interface NurseAnt extends AntBase {
    type: 'nurse';
    state: NurseState;
    assignedChamberIdx: number | undefined;
    carriedEgg: Ant | null;
    targetedEgg: Ant | null;
}

export interface PrincessAnt extends AntBase {
    type: 'princess';
    state: PrincessState;
}

export type Ant = WorkerAnt | SoldierAnt | ScoutAnt | QueenAnt | NurseAnt | PrincessAnt;

export interface ChamberPosition {
    col: number;
    row: number;
}

export interface GameState {
    // Game flow
    running: boolean;
    over: boolean;
    won: boolean;
    survival: boolean;
    tick: number;
    wave: number;
    waveEnemyCount: number;
    nextEnemySpawn: number;

    // Colony
    food: number;
    foodGrid: Float32Array;
    chambers: number;
    chamberPositions: ChamberPosition[];
    queenChamberHalfW: number;
    upkeepTimer: number;
    surfaceRows: number;

    // Entities
    ants: Ant[];
    enemies: Enemy[];

    // Grids
    map: CellType[];
    fog: Float32Array;

    // Nest anchor
    nestCol: number;
    nestRow: number;

    // Cached references
    queen: QueenAnt | null;
    foodCells: FoodSpatialIndex;

    // Goals / flight
    flightStarted: boolean;
    flightTotal: number;
    flightEscaped: number;
    completedFlights: number;

    // Auto flags (source of truth for game logic)
    autoAI: boolean;
    autoSpawn: Record<'worker' | 'soldier' | 'scout' | 'nurse' | 'princess', boolean>;
    autoBuild: Record<'chamber' | 'expand', boolean>;
    autoAction: Record<'flight', boolean>;

    // Cached colony queries (updated each tick by ColonyModule)
    canDigChamber: boolean;
    canSpawnNurse: boolean;
    canSpawnPrincess: boolean;

    // Methods
    reset(): void;
    idx(col: number, row: number): number;
    inBounds(col: number, row: number): boolean;
    popCap(): number;
    chamberCost(): number;
    expandCost(): number;
}

export const STATE: GameState = {
    // Game flow
    running: false,
    over: false,
    won: false,
    survival: false,
    tick: 0,
    wave: 0,
    waveEnemyCount: 0,
    nextEnemySpawn: 0,

    // Colony
    food: 0,
    foodGrid: new Float32Array(CONFIG.COLS * CONFIG.ROWS),
    chambers: 0,
    chamberPositions: [],
    queenChamberHalfW: CONFIG.QUEEN_CHAMBER_HALF_W_INIT,
    upkeepTimer: 0,
    surfaceRows: 0,

    // Entities
    ants: [],
    enemies: [],

    // Grids
    map: [],
    fog: new Float32Array(CONFIG.COLS * CONFIG.ROWS),

    // Nest anchor
    nestCol: 0,
    nestRow: 0,

    // Goals / flight
    flightStarted: false,
    flightTotal: 0,
    flightEscaped: 0,
    completedFlights: 0,

    // Auto flags
    autoAI: false,
    autoSpawn: { worker: false, soldier: false, scout: false, nurse: false, princess: false },
    autoBuild: { chamber: false, expand: false },
    autoAction: { flight: false },

    // Cached colony queries
    canDigChamber: false,
    canSpawnNurse: false,
    canSpawnPrincess: false,

    // Cached references
    queen: null,
    foodCells: new FoodSpatialIndex(),

    reset() {
        this.running = false;
        this.over = false;
        this.won = false;
        this.survival = false;
        this.tick = 0;
        this.wave = 0;
        this.waveEnemyCount = 0;
        this.nextEnemySpawn = CONFIG.ENEMY_SPAWN_INTERVAL;
        this.food = CONFIG.START_FOOD;
        this.chambers = CONFIG.START_CHAMBERS;
        this.chamberPositions = [];
        this.queenChamberHalfW = CONFIG.QUEEN_CHAMBER_HALF_W_INIT;
        this.surfaceRows = CONFIG.SURFACE_ROWS_START;
        this.upkeepTimer = 0;
        this.ants = [];
        this.enemies = [];

        const size = CONFIG.COLS * CONFIG.ROWS;
        this.map = new Array(size).fill('soil');
        this.foodGrid = new Float32Array(size);
        this.fog = new Float32Array(size);
        this.queen = null;
        this.foodCells = new FoodSpatialIndex();
        this.flightStarted = false;
        this.flightTotal = 0;
        this.flightEscaped = 0;
        this.completedFlights = 0;
        this.autoAI = false;
        this.autoSpawn = { worker: false, soldier: false, scout: false, nurse: false, princess: false };
        this.autoBuild = { chamber: false, expand: false };
        this.autoAction = { flight: false };
        this.canDigChamber = false;
        this.canSpawnNurse = false;
        this.canSpawnPrincess = false;
    },

    idx(col: number, row: number): number {
        return row * CONFIG.COLS + col;
    },

    inBounds(col: number, row: number): boolean {
        return col >= 0 && col < CONFIG.COLS && row >= 0 && row < CONFIG.ROWS;
    },

    popCap(): number {
        return this.chambers * CONFIG.ANTS_PER_CHAMBER;
    },

    chamberCost(): number {
        return CONFIG.COST_CHAMBER_BASE + this.chambers * CONFIG.COST_CHAMBER_STEP;
    },

    expandCost(): number {
        const extra = Math.max(0, this.surfaceRows - CONFIG.SURFACE_ROWS_START);
        return CONFIG.SURFACE_EXPAND_COST_BASE + extra * CONFIG.SURFACE_EXPAND_COST_STEP;
    },
};
