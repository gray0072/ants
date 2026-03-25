import { CONFIG } from '../config';
import { STATE, Ant } from '../state';
import { nearestFood, nearestVisibleEnemy, requestPath, requestPathSmart, followPath, depositPheromone, reveal, wander, dist } from '../ant';

export function updateWorker(ant: Ant): void {
    reveal(ant);
    if (ant.attackCooldown > 0) ant.attackCooldown--;

    // Flee if enemy within radius 4 — run to queen
    const threat = nearestVisibleEnemy(ant);
    if (ant.state !== 'flee' && threat && dist(ant.col, ant.row, threat.col, threat.row) <= 4) {
        ant.state = 'flee';
        ant.path = [];
    }

    if (ant.state === 'flee') {
        // No threats left → resume work
        if (!threat || dist(ant.col, ant.row, threat.col, threat.row) > 5) {
            ant.state = ant.carrying > 0 ? 'return' : 'forage';
            ant.path = [];
            return;
        }
        // Path to throne
        const tc = STATE.nestCol, tr = STATE.nestRow - 1;
        const atPost = dist(ant.col, ant.row, tc, tr) < 0.6;
        if (!atPost) {
            if (!ant.path?.length) requestPath(ant, tc, tr);
            followPath(ant);
        } else {
            // At post — face up and fight back
            ant.angle = -Math.PI / 2;
            const d = dist(ant.col, ant.row, threat.col, threat.row);
            if (d <= CONFIG.WORKER_ATTACK_RANGE && ant.attackCooldown === 0) {
                threat.hp -= ant.damage;
                ant.attackCooldown = CONFIG.WORKER_ATTACK_COOLDOWN;
            }
        }
        return;
    }

    if (ant.state === 'forage') {
        if (!ant.path?.length) {
            const food = nearestFood(ant);
            if (food) requestPathSmart(ant, food[0], food[1]);
            else { wander(ant); return; }
        }
        const done = followPath(ant);
        if (done) {
            const c = Math.floor(ant.col), r = Math.floor(ant.row);
            const i = STATE.idx(c, r);
            if (STATE.foodGrid && STATE.foodGrid[i] > 0) {
                const take = Math.min(CONFIG.CARRY_AMOUNT, STATE.foodGrid[i]);
                STATE.foodGrid[i] -= take;
                if (STATE.foodGrid[i] === 0) STATE.foodCells.delete(i);
                ant.carrying = take;
                ant.state = 'return';
                ant.path = [];
            } else {
                ant.path = [];
            }
        }
    } else if (ant.state === 'return') {
        //depositPheromone(ant);
        if (dist(ant.col, ant.row, STATE.nestCol, STATE.nestRow) <= CONFIG.WORKER_DEPOSIT_RANGE) {
            STATE.food += ant.carrying;
            ant.carrying = 0;
            ant.state = 'forage';
            ant.path = [];
        } else {
            if (!ant.path?.length) requestPath(ant, STATE.nestCol, STATE.nestRow);
            followPath(ant);
        }
    }
}