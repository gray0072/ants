import { CONFIG } from './config';
import { STATE, Ant, AntType, AntState, Enemy, QueenAnt, WorkerAnt, SoldierAnt, ScoutAnt, NurseAnt, PrincessAnt } from './state';
import { STATS } from './stats';

type AntTypeMap = {
    worker: WorkerAnt;
    soldier: SoldierAnt;
    scout: ScoutAnt;
    queen: QueenAnt;
    nurse: NurseAnt;
    princess: PrincessAnt;
};
import { MapModule } from './map';
import { FogModule } from './fog';

// Re-export the ant update functions from submodules
export { updateWorker } from './ants/worker';
export { updateSoldier } from './ants/soldier';
export { updateScout } from './ants/scout';
export { updateQueen } from './ants/queen';
export { updateNurse } from './ants/nurse';
export { updatePrincess } from './ants/princess';
export { freeEggsInQueenChamber } from './ants/queen';

let _antId = 0;

export function createAnt<T extends AntType>(type: T, col: number, row: number): AntTypeMap[T] {
    const cfg: Record<AntType, { hp: number; speed: number; damage: number; reveal: number }> = {
        worker: { hp: CONFIG.WORKER_HP, speed: CONFIG.WORKER_SPEED, damage: CONFIG.WORKER_DAMAGE, reveal: CONFIG.WORKER_REVEAL_RADIUS },
        soldier: { hp: CONFIG.SOLDIER_HP, speed: CONFIG.SOLDIER_SPEED, damage: CONFIG.SOLDIER_DAMAGE, reveal: CONFIG.SOLDIER_REVEAL_RADIUS },
        scout: { hp: CONFIG.SCOUT_HP, speed: CONFIG.SCOUT_SPEED, damage: CONFIG.WORKER_DAMAGE, reveal: CONFIG.SCOUT_REVEAL_RADIUS },
        queen: { hp: CONFIG.QUEEN_HP, speed: CONFIG.QUEEN_SPEED, damage: 0, reveal: 3 },
        nurse: { hp: CONFIG.NURSE_HP, speed: CONFIG.NURSE_SPEED, damage: 0, reveal: CONFIG.NURSE_REVEAL_RADIUS },
        princess: { hp: CONFIG.PRINCESS_HP, speed: CONFIG.PRINCESS_SPEED, damage: 0, reveal: CONFIG.PRINCESS_REVEAL_RADIUS },
    };

    const c = cfg[type];

    let initialState: AntState;
    if (type === 'queen') {
        initialState = 'idle';
    } else if (type === 'nurse') {
        initialState = 'fetchEgg';
    } else if (type === 'worker') {
        initialState = 'forage';
    } else if (type === 'scout') {
        initialState = 'scout';
    } else if (type === 'princess') {
        initialState = 'wander';
    } else {
        initialState = 'patrol';
    }

    return {
        id: _antId++,
        type,
        col: col + 0.5,
        row: row + 0.5,
        hp: c.hp,
        maxHp: c.hp,
        speed: c.speed,
        damage: c.damage,
        revealRadius: c.reveal,
        lifestage: null,
        lifestageTick: 0,
        state: initialState,
        path: [],
        targetCol: null,
        targetRow: null,
        carrying: 0,
        attackCooldown: 0,
        eggQueue: type === 'queen' ? [] : undefined,
        assignedChamberIdx: undefined,
        carriedEgg: null,
        targetedEgg: null,
        _carried: false,
        wanderTimer: 0,
        angle: -Math.PI / 2,
        _lastRevealIdx: -1,
        _threatTick: -99,
        _cachedThreat: null,
    } as Ant as AntTypeMap[T];
}

// ---------------------------------------------------------------------------
// Shared helpers — used by all ant-type files
// ---------------------------------------------------------------------------

export function nearestFood(ant: Ant): [number, number] | null {
    let best: [number, number] | null = null;
    let bestDist = Infinity;
    const underground = Math.floor(ant.row) >= STATE.surfaceRows;
    const refCol = underground ? STATE.nestCol + 0.5 : ant.col;
    const refRow = underground ? STATE.surfaceRows - 0.5 : ant.row;
    for (const i of STATE.foodCells) {
        if (!STATE.fog || STATE.fog[i] <= 0) continue;
        const c = i % CONFIG.COLS;
        const r = (i / CONFIG.COLS) | 0;
        if (!MapModule.isPassable(c, r)) continue;
        const d = dist(refCol, refRow, c + 0.5, r + 0.5);
        if (d < bestDist) {
            bestDist = d;
            best = [c, r];
        }
    }
    return best;
}

// Any enemy visible through fog of war
export function nearestVisibleEnemy(ant: Ant): Enemy | null {
    if (ant._cachedThreat && ant._cachedThreat.hp <= 0) ant._cachedThreat = null;
    if (STATE.tick - ant._threatTick < 6) return ant._cachedThreat;
    ant._threatTick = STATE.tick;
    let best: Enemy | null = null;
    let bestDist = Infinity;
    for (const e of STATE.enemies) {
        const ec = Math.floor(e.col);
        const er = Math.floor(e.row);
        if (!STATE.inBounds(ec, er)) continue;
        if (!STATE.fog || STATE.fog[STATE.idx(ec, er)] <= 0) continue;
        const d2 = dist2(ant.col, ant.row, e.col, e.row);
        if (d2 < bestDist) { bestDist = d2; best = e; }
    }
    ant._cachedThreat = best;
    return best;
}

export function nearestAnt(enemy: Enemy, range: number): Ant | null {
    let best: Ant | null = null;
    let bestDist = range * range;
    for (const a of STATE.ants) {
        const d2 = dist2(a.col, a.row, enemy.col, enemy.row);
        // Prefer non-queen targets: penalise queen distance so she's chosen last
        const effective = a.type === 'queen' ? d2 * 4 : d2;
        if (effective < bestDist) { bestDist = effective; best = a; }
    }
    return best;
}

export function dist(x0: number, y0: number, x1: number, y1: number): number {
    return Math.hypot(x1 - x0, y1 - y0);
}

export function dist2(x0: number, y0: number, x1: number, y1: number): number {
    return (x1 - x0) ** 2 + (y1 - y0) ** 2;
}

type Mover = { col: number; row: number; speed: number; angle: number; path: [number, number][] };

export function stepToward(ant: Mover, tc: number, tr: number): boolean {
    const dx = (tc + 0.5) - ant.col;
    const dy = (tr + 0.5) - ant.row;
    const d = Math.hypot(dx, dy);
    if (d < 0.1) return true; // arrived
    ant.angle = Math.atan2(dy, dx);
    ant.col += (dx / d) * ant.speed;
    ant.row += (dy / d) * ant.speed;
    return d < ant.speed + 0.1;
}

export function followPath(ant: Mover): boolean {
    if (!ant.path || ant.path.length === 0) return true;
    const [tc, tr] = ant.path[ant.path.length - 1];
    if (stepToward(ant, tc, tr)) {
        ant.path.pop();
    }
    return ant.path.length === 0;
}

export function requestPath(ant: Ant, tc: number, tr: number): void {
    const fc = Math.floor(ant.col);
    const fr = Math.floor(ant.row);
    if (fc === tc && fr === tr) { ant.path = []; return; }
    const p = MapModule.findPath(fc, fr, tc, tr, MapModule.isPassable);
    ant.path = p || [];
    ant.targetCol = tc;
    ant.targetRow = tr;
}

// On surface both ends are open — skip BFS and go straight.
// Underground → surface: BFS to tunnel exit, then straight to target.
export function requestPathSmart(ant: Ant, tc: number, tr: number): void {
    const antRow = Math.floor(ant.row);
    const antOnSurface = antRow < STATE.surfaceRows;
    const tgtOnSurface = tr < STATE.surfaceRows;
    if (antOnSurface && tgtOnSurface) {
        ant.path = [[tc, tr]];
        ant.targetCol = tc;
        ant.targetRow = tr;
        return;
    }
    const entryC = STATE.nestCol;
    const entryR = STATE.surfaceRows - 1;
    if (!antOnSurface && tgtOnSurface) {
        // BFS underground to tunnel exit, then straight on surface to target
        const bfsPath = MapModule.findPath(Math.floor(ant.col), antRow, entryC, entryR, MapModule.isPassable);
        if (bfsPath) {
            // bfsPath[last] = first step (popped first), bfsPath[0] = exit cell
            // [tc, tr] at index 0 is consumed last — straight line from exit to target
            ant.path = [[tc, tr], ...bfsPath];
            ant.targetCol = tc;
            ant.targetRow = tr;
            return;
        }
    }
    if (antOnSurface && !tgtOnSurface) {
        // Straight on surface to tunnel entrance, then BFS underground to target.
        // Restrict BFS to underground cells only (r >= surfaceRows) so it never
        // routes through surface cells and creates a zigzag.
        const surf = STATE.surfaceRows;
        const bfsPath = MapModule.findPath(entryC, entryR, tc, tr,
            (c, r) => r >= surf && MapModule.isPassable(c, r));
        if (bfsPath) {
            // [entryC, entryR] at the end is consumed first — straight line from ant to entrance
            ant.path = [...bfsPath, [entryC, entryR]];
            ant.targetCol = tc;
            ant.targetRow = tr;
            return;
        }
    }
    requestPath(ant, tc, tr);
}

export function reveal(ant: Ant): void {
    const c = Math.floor(ant.col);
    const r = Math.floor(ant.row);
    const idx = r * CONFIG.COLS + c;
    if (idx === ant._lastRevealIdx) return;
    ant._lastRevealIdx = idx;
    FogModule.revealArea(c, r, ant.revealRadius);
}

export function wander(ant: Ant): void {
    if (ant.wanderTimer-- <= 0) {
        ant.wanderTimer = 20 + Math.floor(Math.random() * 40);
        const tc = Math.floor(ant.col) + Math.floor(Math.random() * 7) - 3;
        const tr = Math.floor(ant.row) + Math.floor(Math.random() * 7) - 3;
        if (STATE.inBounds(tc, tr) && MapModule.isPassable(tc, tr)) {
            requestPath(ant, tc, tr);
        }
    } else {
        followPath(ant);
    }
}

// ---------------------------------------------------------------------------
// Flight guard — shared by soldier and worker
// ---------------------------------------------------------------------------

export function assignRingPosition(ant: WorkerAnt | SoldierAnt): void {
    const exitCol = STATE.nestCol;
    const exitRow = STATE.surfaceRows - 1;
    const rMin = ant.type === 'worker' ? CONFIG.WORKER_RING_RADIUS_MIN : CONFIG.SOLDIER_RING_RADIUS_MIN;
    const rMax = ant.type === 'worker' ? CONFIG.WORKER_RING_RADIUS_MAX : CONFIG.SOLDIER_RING_RADIUS_MAX;
    const radius = rMin + Math.random() * (rMax - rMin);
    const angle = -Math.PI + Math.random() * Math.PI; // upper semicircle
    ant.targetCol = Math.max(0, Math.min(CONFIG.COLS - 1, Math.round(exitCol + Math.cos(angle) * radius)));
    ant.targetRow = Math.max(0, Math.min(STATE.surfaceRows - 1, Math.round(exitRow + Math.sin(angle) * radius)));
    ant.path = [];
}

/**
 * Handles 'surface', 'fly', and 'chase' (during flight) states for any ant
 * guarding the ring. Also intercepts any state when flightStarted and assigns
 * ring position. Returns true if the state was handled (caller should return).
 */
export function updateFlightGuardStates(ant: WorkerAnt | SoldierAnt, attackRange: number, attackCooldownReset: number): boolean {
    // Flight ended — release ants from guard duty back to normal states
    if (!STATE.flightStarted && (ant.state === 'surface' || ant.state === 'fly')) {
        if (ant.type === 'soldier') ant.state = 'patrol';
        else ant.state = ant.carrying > 0 ? 'return' : 'forage';
        ant.path = [];
        ant.targetCol = null;
        ant.targetRow = null;
        return false;
    }
    if (ant.state === 'surface') {
        const enemy = nearestVisibleEnemy(ant);
        if (enemy && dist(ant.col, ant.row, enemy.col, enemy.row) <= CONFIG.FLIGHT_GUARD_CHASE_RADIUS) {
            const d = dist(ant.col, ant.row, enemy.col, enemy.row);
            if (d <= attackRange) {
                if (ant.attackCooldown === 0) {
                    enemy.hp -= ant.damage;
                    ant.attackCooldown = attackCooldownReset;
                }
            } else {
                requestPathSmart(ant, Math.floor(enemy.col), Math.floor(enemy.row));
                followPath(ant);
            }
            return true;
        }
        if (ant.path.length === 0 && ant.targetCol !== null && ant.targetRow !== null) {
            requestPathSmart(ant, ant.targetCol, ant.targetRow);
        }
        if (ant.path.length > 0) followPath(ant);
        if (ant.targetCol !== null && ant.targetRow !== null
            && dist(ant.col, ant.row, ant.targetCol + 0.5, ant.targetRow + 0.5) < 1.0) {
            ant.path = [];
            ant.state = 'fly';
        }
        return true;
    }

    if (ant.state === 'fly') {
        const enemy = nearestVisibleEnemy(ant);
        if (enemy && dist(ant.col, ant.row, enemy.col, enemy.row) <= CONFIG.FLIGHT_GUARD_CHASE_RADIUS) {
            const d = dist(ant.col, ant.row, enemy.col, enemy.row);
            if (d <= attackRange) {
                if (ant.attackCooldown === 0) {
                    enemy.hp -= ant.damage;
                    ant.attackCooldown = attackCooldownReset;
                }
            } else {
                ant.state = 'chase';
                requestPathSmart(ant, Math.floor(enemy.col), Math.floor(enemy.row));
                followPath(ant);
            }
            return true;
        }
        // Rotate in place, facing away from nest exit
        const exitCol = STATE.nestCol + 0.5;
        const exitRow = (STATE.surfaceRows - 1) + 0.5;
        ant.angle = Math.atan2(exitRow - ant.row, exitCol - ant.col) + Math.PI
            + Math.sin(STATE.tick * 0.015) * 0.6;
        return true;
    }

    if (ant.state === 'chase' && STATE.flightStarted) {
        // Give up chase if too far from ring position
        if (ant.targetCol !== null && ant.targetRow !== null
            && dist(ant.col, ant.row, ant.targetCol + 0.5, ant.targetRow + 0.5) > CONFIG.FLIGHT_GUARD_CHASE_RADIUS) {
            ant.state = 'surface';
            return true;
        }
        const enemy = nearestVisibleEnemy(ant);
        if (enemy && dist(ant.col, ant.row, enemy.col, enemy.row) <= CONFIG.FLIGHT_GUARD_CHASE_RADIUS) {
            const d = dist(ant.col, ant.row, enemy.col, enemy.row);
            if (d <= attackRange) {
                if (ant.attackCooldown === 0) {
                    enemy.hp -= ant.damage;
                    ant.attackCooldown = attackCooldownReset;
                }
            } else {
                requestPathSmart(ant, Math.floor(enemy.col), Math.floor(enemy.row));
                followPath(ant);
            }
            return true;
        }
        // Enemy gone or out of range — pick new ring spot and return
        assignRingPosition(ant);
        ant.state = 'surface';
        return true;
    }

    if (STATE.flightStarted) {
        assignRingPosition(ant);
        ant.state = 'surface';
        return true;
    }

    return false;
}

// ---------------------------------------------------------------------------
// Ant Module
// ---------------------------------------------------------------------------

function updateLifestage(ant: Ant): void {
    ant.lifestageTick--;
    if (ant.lifestageTick > 0) return;
    if (ant.lifestage === 'egg') {
        ant.lifestage = 'larva';
        ant.lifestageTick = CONFIG.LARVA_TICKS;
    } else if (ant.lifestage === 'larva') {
        ant.lifestage = 'pupa';
        ant.lifestageTick = CONFIG.PUPA_TICKS;
    } else if (ant.lifestage === 'pupa') {
        ant.lifestage = null; // hatched
        STATS.totalAntsProduced++;
    }
}

function endGame(won: boolean): void {
    STATE.over = true;
    STATE.won = won;
    STATE.running = false;
}

// Import the update functions from submodules
import { updateWorker } from './ants/worker';
import { updateSoldier } from './ants/soldier';
import { updateScout } from './ants/scout';
import { updateQueen } from './ants/queen';
import { updateNurse } from './ants/nurse';
import { updatePrincess } from './ants/princess';

export const AntModule = {
    update(): void {
        for (const ant of STATE.ants) {
            if (ant.hp <= 0) continue;
            if (ant.lifestage) { updateLifestage(ant); continue; }
            switch (ant.type) {
                case 'worker': updateWorker(ant); break;
                case 'soldier': updateSoldier(ant); break;
                case 'scout': updateScout(ant); break;
                case 'queen': updateQueen(ant); break;
                case 'nurse': updateNurse(ant); break;
                case 'princess': updatePrincess(ant); break;
            }
        }

        // Remove dead ants and locate queen in a single pass
        let queen: QueenAnt | null = null;
        let i = STATE.ants.length;
        while (i--) {
            const a = STATE.ants[i];
            if (a.hp <= 0) {
                if (STATE.flightStarted && a.type === 'princess' && a.lifestage === null
                        && (a.state === 'fly' || a.state === 'surface' || a.state === 'prepare')) {
                    STATE.flightEscaped++;
                }
                STATE.ants.splice(i, 1);
                continue;
            }
            if (a.type === 'queen') queen = a as QueenAnt;
        }
        STATE.queen = queen;
        if (STATE.ants.length > STATS.maxAnts) STATS.maxAnts = STATE.ants.length;
        if (!STATE.queen) { endGame(false); return; }
        STATE.queenHp = STATE.queen.hp;
    },

    nearestAnt: nearestAnt,
    dist: dist,
    dist2: dist2,
};