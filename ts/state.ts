import { CONFIG } from './config';

// Type definitions
export type CellType = 'soil' | 'tunnel' | 'chamber' | 'surface';
export type AntType = 'worker' | 'soldier' | 'scout' | 'queen' | 'nurse';
export type Lifestage = 'egg' | 'larva' | 'pupa' | null;

// Per-ant-type state unions
export type WorkerState  = 'forage' | 'return' | 'flee';
export type SoldierState = 'patrol' | 'chase';
export type ScoutState   = 'scout';
export type QueenState   = 'idle' | 'layEgg' | 'returnToThrone';
export type NurseState   = 'fetchEgg' | 'waitInChamber';
export type AntState     = WorkerState | SoldierState | ScoutState | QueenState | NurseState;

export type EggOrderType = AntType;

export interface EggOrder {
  type: EggOrderType;
}

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
  state: string;
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
  stuckTimer: number;
  prevCol: number;
  prevRow: number;
  wanderTimer: number;
  angle: number;
  _lastRevealIdx: number;
  _threatTick: number;
  _cachedThreat: Enemy | null;
}

export interface WorkerAnt extends AntBase {
  type: 'worker';
  state: WorkerState;
  eggQueue: undefined;
  assignedChamberIdx: undefined;
  carriedEgg: null;
  targetedEgg: null;
}

export interface SoldierAnt extends AntBase {
  type: 'soldier';
  state: SoldierState;
  eggQueue: undefined;
  assignedChamberIdx: undefined;
  carriedEgg: null;
  targetedEgg: null;
}

export interface ScoutAnt extends AntBase {
  type: 'scout';
  state: ScoutState;
  eggQueue: undefined;
  assignedChamberIdx: undefined;
  carriedEgg: null;
  targetedEgg: null;
}

export interface QueenAnt extends AntBase {
  type: 'queen';
  state: QueenState;
  eggQueue: EggOrder[];
  assignedChamberIdx: undefined;
  carriedEgg: null;
  targetedEgg: null;
}

export interface NurseAnt extends AntBase {
  type: 'nurse';
  state: NurseState;
  eggQueue: undefined;
  assignedChamberIdx: number | undefined;
  carriedEgg: Ant | null;
  targetedEgg: Ant | null;
}

export type Ant = WorkerAnt | SoldierAnt | ScoutAnt | QueenAnt | NurseAnt;

export interface ChamberPosition {
  col: number;
  row: number;
}

export interface GameState {
  // Game flow
  running: boolean;
  over: boolean;
  won: boolean;
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
  pheromone: Float32Array | null;
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

  // Methods
  reset(): void;
  idx(col: number, row: number): number;
  inBounds(col: number, row: number): boolean;
  popCap(): number;
  chamberCost(): number;
  expandCost(): number;
}

let _antId = 0;
let _enemyId = 0;

export function getNextAntId(): number {
  return _antId++;
}

export function getNextEnemyId(): number {
  return _enemyId++;
}

export const STATE: GameState = {
  // Game flow
  running: false,
  over: false,
  won: false,
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
  pheromone: null,
  fog: null,

  // Nest anchor
  nestCol: 0,
  nestRow: 0,

  // Cached references
  queen: null,
  foodCells: new Set(),

  // Flow field
  nestFlowDir: null,
  nestFlowDist: null,
  nestFlowDirty: true,

  reset() {
    _antId = 0;
    _enemyId = 0;
    this.running = false;
    this.over = false;
    this.won = false;
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
    this.pheromone = new Float32Array(size);
    this.fog = new Float32Array(size);
    this.queen = null;
    this.foodCells = new Set();
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
