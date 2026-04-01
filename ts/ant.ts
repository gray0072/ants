import { CONFIG } from './config';
import { STATE, Ant, AntType, AntState, Enemy, QueenAnt, WorkerAnt, SoldierAnt, ScoutAnt, NurseAnt, PrincessAnt, Mover } from './state';
import { STATS } from './stats';
import { MapModule } from './map';
import { FogModule } from './fog';
import { requestPath, followPath } from './path';
import { updateWorker } from './ants/worker';
import { updateSoldier } from './ants/soldier';
import { updateScout } from './ants/scout';
import { updateQueen } from './ants/queen';
import { updateNurse } from './ants/nurse';
import { updatePrincess } from './ants/princess';
import { PERF } from './perf';

type AntTypeMap = {
    worker: WorkerAnt;
    soldier: SoldierAnt;
    scout: ScoutAnt;
    queen: QueenAnt;
    nurse: NurseAnt;
    princess: PrincessAnt;
};

export function createAnt<T extends AntType>(type: T, col: number, row: number): AntTypeMap[T] {
    const cfg: Record<AntType, { hp: number; speed: number; reveal: number; attackRange: number; damage: number; baseCooldown: number }> = {
        worker: { hp: CONFIG.WORKER_HP, speed: CONFIG.WORKER_SPEED, reveal: CONFIG.WORKER_REVEAL_RADIUS, attackRange: CONFIG.WORKER_ATTACK_RANGE, damage: CONFIG.WORKER_DAMAGE, baseCooldown: CONFIG.WORKER_ATTACK_COOLDOWN },
        soldier: { hp: CONFIG.SOLDIER_HP, speed: CONFIG.SOLDIER_SPEED, reveal: CONFIG.SOLDIER_REVEAL_RADIUS, attackRange: CONFIG.SOLDIER_ATTACK_RANGE, damage: CONFIG.SOLDIER_DAMAGE, baseCooldown: CONFIG.SOLDIER_ATTACK_COOLDOWN },
        scout: { hp: CONFIG.SCOUT_HP, speed: CONFIG.SCOUT_SPEED, reveal: CONFIG.SCOUT_REVEAL_RADIUS, attackRange: 0, damage: 0, baseCooldown: 0 },
        queen: { hp: CONFIG.QUEEN_HP, speed: CONFIG.QUEEN_SPEED, reveal: CONFIG.QUEEN_REVEAL_RADIUS, attackRange: CONFIG.QUEEN_ATTACK_RANGE, damage: CONFIG.QUEEN_DAMAGE, baseCooldown: CONFIG.QUEEN_ATTACK_COOLDOWN },
        nurse: { hp: CONFIG.NURSE_HP, speed: CONFIG.NURSE_SPEED, reveal: CONFIG.NURSE_REVEAL_RADIUS, attackRange: 0, damage: 0, baseCooldown: 0 },
        princess: { hp: CONFIG.PRINCESS_HP, speed: CONFIG.PRINCESS_SPEED, reveal: CONFIG.PRINCESS_REVEAL_RADIUS, attackRange: 0, damage: 0, baseCooldown: 0 },
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
        type,
        col: col + 0.5,
        row: row + 0.5,
        hp: c.hp,
        maxHp: c.hp,
        speed: c.speed,
        attackRange: c.attackRange,
        damage: c.damage,
        revealRadius: c.reveal,
        lifestage: null,
        lifestageTick: 0,
        state: initialState,
        path: [],
        targetCol: null,
        targetRow: null,
        attackCooldown: 0,
        baseCooldown: c.baseCooldown,
        eggQueue: type === 'queen' ? [] : undefined,
        carriedFood: type === 'worker' ? 0 : undefined,
        assignedChamberIdx: undefined,
        carriedEgg: null,
        targetedEgg: null,
        _carried: false,
        wanderTimer: 0,
        angle: -Math.PI / 2,
        _lastRevealIdx: -1,
        cachedTarget: null, cachedTargetTTL: 0,
    } as Ant as AntTypeMap[T];
}

// ---------------------------------------------------------------------------
// Shared helpers — used by all ant-type files
// ---------------------------------------------------------------------------

export function nearestFood(ant: Ant): [number, number] | null {
    const underground = ant.row >= STATE.surfaceRows;
    const refCol = underground ? STATE.nestCol + 0.5 : ant.col;
    const refRow = underground ? STATE.surfaceRows - 0.5 : ant.row;
    const fog = STATE.fog;
    return STATE.foodCells.findNearest(refCol, refRow, (i, _c, _r) => fog[i] > 0);
}

export function nearestVisibleEnemy(ant: Ant): Enemy | null {
    if (ant.cachedTarget && ant.cachedTarget.hp <= 0) ant.cachedTarget = null;
    if (--ant.cachedTargetTTL > 0) return ant.cachedTarget;
    let best: Enemy | null = null;
    let bestD2 = Infinity;
    for (const e of STATE.enemies) {
        if (e.hp <= 0) continue;
        const ec = Math.floor(e.col);
        const er = Math.floor(e.row);
        if (STATE.fog[STATE.idx(ec, er)] <= 0) continue;
        const d2 = dist2(ant.col, ant.row, e.col, e.row);
        if (d2 < bestD2) { bestD2 = d2; best = e; }
    }
    ant.cachedTarget = best;
    ant.cachedTargetTTL = best ? Math.max(5, (Math.sqrt(bestD2) - best.attackRange) / (ant.speed + best.speed)) : 5;
    return best;
}

export function dist(x0: number, y0: number, x1: number, y1: number): number {
    return Math.hypot(x1 - x0, y1 - y0);
}

export function dist2(x0: number, y0: number, x1: number, y1: number): number {
    return (x1 - x0) ** 2 + (y1 - y0) ** 2;
}

export type AttackResult = 'outOfRange' | 'cooldown' | 'hitDone';

export function tryAttack(
    attacker: { col: number; row: number; attackRange: number; damage: number; attackCooldown: number; baseCooldown: number },
    target: { col: number; row: number; hp: number }
): AttackResult {
    if (dist2(attacker.col, attacker.row, target.col, target.row) > attacker.attackRange * attacker.attackRange) return 'outOfRange';
    if (attacker.attackCooldown > 0) return 'cooldown';
    target.hp -= attacker.damage;
    attacker.attackCooldown = attacker.baseCooldown;
    return 'hitDone';
}

export function chaseTarget(
    mover: Mover & { targetCol: number | null; targetRow: number | null },
    target: { col: number; row: number }
): void {
    const tc = Math.floor(target.col), tr = Math.floor(target.row);
    if (!mover.path?.length || mover.targetCol !== tc || mover.targetRow !== tr) {
        requestPath(mover, tc, tr);
    }
    followPath(mover);
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
export function updateFlightGuardStates(ant: WorkerAnt | SoldierAnt): boolean {
    // Flight ended — release ants from guard duty back to normal states
    if (!STATE.flightStarted && (ant.state === 'surface' || ant.state === 'fly')) {
        if (ant.type === 'soldier') ant.state = 'patrol';
        else ant.state = ant.carriedFood > 0 ? 'return' : 'forage';
        ant.path = [];
        ant.targetCol = null;
        ant.targetRow = null;
        return false;
    }
    if (ant.state === 'surface') {
        const enemy = nearestVisibleEnemy(ant);
        if (enemy && dist2(ant.col, ant.row, enemy.col, enemy.row) <= CONFIG.FLIGHT_GUARD_CHASE_RADIUS * CONFIG.FLIGHT_GUARD_CHASE_RADIUS) {
            if (tryAttack(ant, enemy) === 'outOfRange') {
                chaseTarget(ant, enemy);
            }
            return true;
        }
        if (!ant.path.length && ant.targetCol !== null && ant.targetRow !== null) {
            requestPath(ant, ant.targetCol, ant.targetRow);
        }
        const arrived = followPath(ant);
        if (arrived) {
            ant.path = [];
            ant.state = 'fly';
        }
        return true;
    }

    if (ant.state === 'fly') {
        const enemy = nearestVisibleEnemy(ant);
        if (enemy && ant.targetCol !== null && ant.targetRow !== null
            && dist2(ant.targetCol, ant.targetRow, enemy.col, enemy.row) <= CONFIG.FLIGHT_GUARD_CHASE_RADIUS * CONFIG.FLIGHT_GUARD_CHASE_RADIUS) {
            if (tryAttack(ant, enemy) === 'outOfRange') {
                ant.state = 'chase';
                chaseTarget(ant, enemy);
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
            && dist2(ant.col, ant.row, ant.targetCol + 0.5, ant.targetRow + 0.5) > CONFIG.FLIGHT_GUARD_CHASE_RADIUS * CONFIG.FLIGHT_GUARD_CHASE_RADIUS) {
            ant.state = 'surface';
            ant.path = [];
            return true;
        }
        const enemy = nearestVisibleEnemy(ant);
        if (enemy && dist2(ant.col, ant.row, enemy.col, enemy.row) <= CONFIG.FLIGHT_GUARD_CHASE_RADIUS * CONFIG.FLIGHT_GUARD_CHASE_RADIUS) {
            if (tryAttack(ant, enemy) === 'outOfRange') {
                chaseTarget(ant, enemy);
            }
            return true;
        }
        // Enemy gone or out of range — return to ring spot
        ant.state = 'surface';
        ant.path = [];
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

export const AntModule = {
    update(): void {
        for (const ant of STATE.ants) {
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

        // Remove dead ants and locate queen in a single pass (swap-compact, O(n))
        let queen: QueenAnt | null = null;
        let alive = 0;
        for (let i = 0; i < STATE.ants.length; i++) {
            const a = STATE.ants[i];
            if (a.hp <= 0) {
                if (STATE.flightStarted && a.type === 'princess' && a.lifestage === null
                    && (a.state === 'fly' || a.state === 'surface' || a.state === 'prepare')) {
                    STATE.flightEscaped++;
                }
                continue;
            }
            if (a.type === 'queen') queen = a as QueenAnt;
            STATE.ants[alive++] = a;
        }
        STATE.ants.length = alive;
        STATE.queen = queen;
        if (STATE.ants.length > STATS.maxAnts) STATS.maxAnts = STATE.ants.length;
        if (!STATE.queen) { endGame(false); return; }
    },
};