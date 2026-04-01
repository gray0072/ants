import { CONFIG } from './config';
import { STATE, Enemy, Ant } from './state';
import { STATS } from './stats';
import { dist2, tryAttack, chaseTarget } from './ant';

export type EnemyType = 'beetle' | 'spider';

export function createEnemy(type: EnemyType, col: number, row: number): Enemy {
    const cfg = {
        beetle: { hp: CONFIG.BEETLE_HP, speed: CONFIG.BEETLE_SPEED, damage: CONFIG.BEETLE_DAMAGE, cooldown: CONFIG.BEETLE_ATTACK_COOLDOWN },
        spider: { hp: CONFIG.SPIDER_HP, speed: CONFIG.SPIDER_SPEED, damage: CONFIG.SPIDER_DAMAGE, cooldown: CONFIG.SPIDER_ATTACK_COOLDOWN },
    }[type]!;

    return {
        type,
        col: col + 0.5,
        row: row + 0.5,
        hp: cfg.hp,
        maxHp: cfg.hp,
        speed: cfg.speed,
        attackRange: CONFIG.ENEMY_ATTACK_RANGE,
        damage: cfg.damage,
        attackCooldown: 0,
        baseCooldown: cfg.cooldown,
        path: [],
        targetCol: null,
        targetRow: null,
        wanderTimer: 0,
        angle: Math.PI / 2,
        cachedTarget: null,
        cachedTargetTTL: 0,
    };
}

function getNearestTarget(e: Enemy): Ant | null {
    if (e.cachedTarget && e.cachedTarget.hp <= 0) e.cachedTarget = null;
    if (--e.cachedTargetTTL > 0) return e.cachedTarget;
    let best: Ant | null = null;
    let bestD2 = Infinity;
    for (const a of STATE.ants) {
        if (a.hp <= 0) continue;
        const d2 = dist2(a.col, a.row, e.col, e.row);
        if (d2 < bestD2) { bestD2 = d2; best = a; }
    }
    e.cachedTarget = best;
    e.cachedTargetTTL = best ? Math.max(2, (Math.sqrt(bestD2) - e.attackRange) / (e.speed + best.speed)) : 5;
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

        for (const e of STATE.enemies) {
            if (e.attackCooldown > 0) e.attackCooldown--;

            const target = getNearestTarget(e);
            if (!target) {
                continue;
            }

            if (tryAttack(e, target) === 'outOfRange') {
                chaseTarget(e, target);
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