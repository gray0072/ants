import { CONFIG } from '../config';
import { STATE, WorkerAnt } from '../state';
import { STATS } from '../stats';
import { nearestFood, updateFlightGuardStates, reveal, wander, dist2, nearestVisibleEnemy, tryAttack } from '../ant';
import { requestPath, followPath } from '../path';

export function updateWorker(ant: WorkerAnt): void {
    reveal(ant);
    if (ant.attackCooldown > 0) ant.attackCooldown--;

    if (updateFlightGuardStates(ant)) return;

    const threat = nearestVisibleEnemy(ant);
    // Flee if enemy within flee radius — run to queen
    if (ant.state !== 'flee' && threat && dist2(ant.col, ant.row, threat.col, threat.row) <= CONFIG.WORKER_FLEE_RADIUS * CONFIG.WORKER_FLEE_RADIUS) {
        ant.state = 'flee';
        ant.path = [];
    }

    if (ant.state === 'flee') {
        // No threats left → resume work
        if (!threat || dist2(ant.col, ant.row, threat.col, threat.row) > CONFIG.WORKER_FLEE_CLEAR * CONFIG.WORKER_FLEE_CLEAR) {
            ant.state = ant.carriedFood > 0 ? 'return' : 'forage';
            ant.path = [];
            return;
        }
        // Path to throne
        const tc = STATE.nestCol, tr = STATE.nestRow - 1;

        if (!ant.path?.length) {
            requestPath(ant, tc, tr);
        }
        const done = followPath(ant);
        if (done) {
            // At post — face up and fight back
            ant.angle = -Math.PI / 2;
            tryAttack(ant, threat);
        }
        return;
    }

    if (ant.state === 'forage') {
        if (!ant.path?.length) {
            const food = nearestFood(ant);
            if (food) requestPath(ant, food[0], food[1]);
            else { wander(ant); return; }
        }
        const done = followPath(ant);
        if (done) {
            const c = Math.floor(ant.col), r = Math.floor(ant.row);
            const i = STATE.idx(c, r);
            if (STATE.foodGrid[i] > 0) {
                const take = Math.min(CONFIG.CARRY_AMOUNT, STATE.foodGrid[i]);
                STATE.foodGrid[i] -= take;
                if (STATE.foodGrid[i] === 0) STATE.foodCells.delete(i);
                ant.carriedFood = take;
                ant.state = 'return';
                ant.path = [];
            } else {
                ant.path = [];
            }
        }
    } else if (ant.state === 'return') {
        if (dist2(ant.col, ant.row, STATE.nestCol, STATE.nestRow) <= CONFIG.WORKER_DEPOSIT_RANGE * CONFIG.WORKER_DEPOSIT_RANGE) {
            STATS.totalFoodCollected += ant.carriedFood;
            STATE.food += ant.carriedFood;
            ant.carriedFood = 0;
            ant.state = 'forage';
            ant.path = [];
        } else {
            if (!ant.path?.length) requestPath(ant, STATE.nestCol, STATE.nestRow);
            followPath(ant);
        }
    }
}
