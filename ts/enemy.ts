import { CONFIG } from './config';
import { STATE, Enemy, Ant } from './state';
import { MapModule } from './map';
import { STATS } from './stats';
import { dist2, stepToward, followPath } from './ant';

let _enemyId = 0;

export type EnemyType = 'beetle' | 'spider';

function createEnemy(type: EnemyType, col: number, row: number): Enemy {
    const cfg = {
        beetle: { hp: CONFIG.BEETLE_HP, speed: CONFIG.BEETLE_SPEED, damage: CONFIG.BEETLE_DAMAGE, cooldown: CONFIG.BEETLE_ATTACK_COOLDOWN },
        spider: { hp: CONFIG.SPIDER_HP, speed: CONFIG.SPIDER_SPEED, damage: CONFIG.SPIDER_DAMAGE, cooldown: CONFIG.SPIDER_ATTACK_COOLDOWN },
    }[type]!;

    return {
        id: _enemyId++,
        type,
        col: col + 0.5,
        row: row + 0.5,
        hp: cfg.hp,
        maxHp: cfg.hp,
        speed: cfg.speed,
        damage: cfg.damage,
        attackCooldown: 0,
        baseCooldown: cfg.cooldown,
        path: [],
        targetCol: null,
        targetRow: null,
        state: 'wander',
        wanderTimer: 0,
        angle: Math.PI / 2,
        _targetTick: -99,
        _cachedTarget: null,
    };
}

const FLOW_DIRS = [
    [0, -1],  // N
    [1, -1],  // NE
    [1, 0],   // E
    [1, 1],   // SE
    [0, 1],   // S
    [-1, 1],  // SW
    [-1, 0],  // W
    [-1, -1], // NW
];

function requestPath(e: Enemy, tc: number, tr: number): void {
    const fc = Math.floor(e.col), fr = Math.floor(e.row);
    if (fc === tc && fr === tr) { e.path = []; return; }
    const p = MapModule.findPath(fc, fr, tc, tr, MapModule.isPassableForEnemy);
    e.path = p || [];
    e.targetCol = tc;
    e.targetRow = tr;
}

// Move one step toward nest using pre-computed flow field — O(1) per enemy
function followNestFlow(e: Enemy): void {
    if (STATE.nestFlowDirty) MapModule.buildNestFlow();
    const c = Math.floor(e.col), r = Math.floor(e.row);
    if (!STATE.inBounds(c, r)) return;
    const i = r * CONFIG.COLS + c;
    const flowDist = STATE.nestFlowDist;
    const flowDir = STATE.nestFlowDir;
    if (!flowDist || !flowDir || flowDist[i] < 0) return; // unreachable
    const [dc, dr] = FLOW_DIRS[flowDir[i]]!;
    stepToward(e, c + dc, r + dr);
}

// Throttled nearest-ant lookup — refreshed every 8 ticks, staggered by enemy id
function getCachedTarget(e: Enemy): Ant | null {
    if (e._cachedTarget && e._cachedTarget.hp <= 0) e._cachedTarget = null;
    if (STATE.tick - e._targetTick < 8) return e._cachedTarget;
    e._targetTick = STATE.tick;

    let best: Ant | null = null;
    let bestD2 = Infinity;
    for (const a of STATE.ants) {
        const d2 = dist2(a.col, a.row, e.col, e.row);
        const effective = a.type === 'queen' ? d2 * 4 : d2;
        if (effective < bestD2) { bestD2 = effective; best = a; }
    }
    e._cachedTarget = best;
    return best;
}

function spawnWave(): void {
    STATE.wave++;
    const count = Math.min(
        Math.ceil(CONFIG.ENEMY_SPAWN_COUNT * Math.pow(CONFIG.ENEMY_WAVE_SCALE, STATE.wave - 1)),
        CONFIG.ENEMY_MAX - STATE.enemies.length,
    );
    STATE.waveEnemyCount = count;
    if (count <= 0) return;
    const { COLS } = CONFIG;
    for (let i = 0; i < count; i++) {
        const side = Math.random() < 0.5;
        const col = side ? 0 : COLS - 1;
        const row = Math.floor(Math.random() * STATE.surfaceRows);
        const type = Math.random() < 0.6 ? 'beetle' : 'spider';
        STATE.enemies.push(createEnemy(type, col, row));
    }
}

export const EnemyModule = {
    update(): void {
        if (STATE.tick >= STATE.nextEnemySpawn) {
            spawnWave();
            STATE.nextEnemySpawn = STATE.tick + CONFIG.ENEMY_SPAWN_INTERVAL;
        }

        // Budget for expensive BFS calls this tick (underground chase only)
        let bfsBudget = 8;

        for (const e of STATE.enemies) {
            if (e.hp <= 0) continue;
            if (e.attackCooldown > 0) e.attackCooldown--;

            const target = getCachedTarget(e);
            if (!target) {
                followNestFlow(e);
                continue;
            }

            const d2 = dist2(e.col, e.row, target.col, target.row);
            if (d2 <= 1.5 * 1.5) {
                // Attack
                if (e.attackCooldown === 0) {
                    target.hp -= e.damage;
                    e.attackCooldown = e.baseCooldown;
                    if (target.type === 'queen') STATE.queenHp = target.hp;
                }
            } else {
                // Chase — use direct movement on surface, BFS only underground
                const er = Math.floor(e.row);
                const tc = Math.floor(target.col), tr = Math.floor(target.row);
                const onSurface = er < STATE.surfaceRows && tr < STATE.surfaceRows;
                if (onSurface) {
                    // Surface is open — step directly
                    stepToward(e, tc, tr);
                    e.path = [];
                } else {
                    // Underground — use BFS with budget
                    if (!e.path?.length || e.targetCol !== tc || e.targetRow !== tr) {
                        if (bfsBudget-- > 0) requestPath(e, tc, tr);
                    }
                    followPath(e);
                }
            }
        }

        let alive = 0;
        for (let ei = 0; ei < STATE.enemies.length; ei++) {
            if (STATE.enemies[ei].hp <= 0) { STATS.totalEnemiesKilled++; }
            else { STATE.enemies[alive++] = STATE.enemies[ei]; }
        }
        STATE.enemies.length = alive;
    },

    spawnWave(): void {
        spawnWave();
    },
};