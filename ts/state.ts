import { CONFIG } from './config';

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


export type EnemyState = 'wander' | 'chase';

export interface Enemy {
    id: number;
    type: 'beetle' | 'spider';
    col: number;
    row: number;
    hp: number;
    maxHp: number;
    speed: number;
    damage: number;
    attackCooldown: number;
    baseCooldown: number;
    path: [number, number][];
    targetCol: number | null;
    targetRow: number | null;
    state: EnemyState;
    wanderTimer: number;
    angle: number;
    _targetTick: number;
    _cachedTarget: Ant | null;
}

// Shared base fields — not exported directly; use the Ant union instead
interface AntBase {
    id: number;
    col: number;
    row: number;
    hp: number;
    maxHp: number;
    speed: number;
    damage: number;
    revealRadius: number;
    lifestage: Lifestage;
    lifestageTick: number;
    path: [number, number][];
    targetCol: number | null;
    targetRow: number | null;
    carrying: number;
    attackCooldown: number;
    _carried: boolean;
    wanderTimer: number;
    angle: number;
    _lastRevealIdx: number;
    _threatTick: number;
    _cachedThreat: Enemy | null;
}

export interface WorkerAnt extends AntBase {
    type: 'worker';
    state: WorkerState;
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
    foodGrid: Float32Array | null;
    chambers: number;
    chamberPositions: ChamberPosition[];
    queenHp: number;
    upkeepTimer: number;
    surfaceRows: number;

    // Entities
    ants: Ant[];
    enemies: Enemy[];

    // Grids
    map: CellType[];
    fog: Float32Array | null;

    // Nest anchor
    nestCol: number;
    nestRow: number;

    // Cached references
    queen: QueenAnt | null;
    foodCells: Set<number>;

    // Flow field
    nestFlowDir: Uint8Array | null;
    nestFlowDist: Int32Array | null;
    nestFlowDirty: boolean;

    // Goals / flight
    flightStarted: boolean;
    flightTotal: number;
    flightEscaped: number;
    completedFlights: number;

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
    foodGrid: null,
    chambers: 0,
    chamberPositions: [],
    queenHp: 0,
    upkeepTimer: 0,
    surfaceRows: 0,

    // Entities
    ants: [],
    enemies: [],

    // Grids
    map: [],
    fog: null,

    // Nest anchor
    nestCol: 0,
    nestRow: 0,

    // Goals / flight
    flightStarted: false,
    flightTotal: 0,
    flightEscaped: 0,
    completedFlights: 0,

    // Cached references
    queen: null,
    foodCells: new Set(),

    // Flow field
    nestFlowDir: null,
    nestFlowDist: null,
    nestFlowDirty: true,

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
        this.surfaceRows = CONFIG.SURFACE_ROWS_START;
        this.queenHp = CONFIG.QUEEN_HP;
        this.upkeepTimer = 0;
        this.ants = [];
        this.enemies = [];

        const size = CONFIG.COLS * CONFIG.ROWS;
        this.map = new Array(size).fill('soil');
        this.foodGrid = new Float32Array(size);
        this.fog = new Float32Array(size);
        this.queen = null;
        this.foodCells = new Set();
        this.flightStarted = false;
        this.flightTotal = 0;
        this.flightEscaped = 0;
        this.completedFlights = 0;
        this.nestFlowDir = null;
        this.nestFlowDist = null;
        this.nestFlowDirty = true;
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
