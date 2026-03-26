import { CONFIG } from '../config';
import { STATE, SoldierAnt } from '../state';
import { MapModule } from '../map';
import { nearestVisibleEnemy, updateFlightGuardStates, requestPathSmart, followPath, reveal, dist } from '../ant';

export function updateSoldier(ant: SoldierAnt): void {
    reveal(ant);
    if (ant.attackCooldown > 0) ant.attackCooldown--;

    if (updateFlightGuardStates(ant, CONFIG.SOLDIER_ATTACK_RANGE, CONFIG.SOLDIER_ATTACK_COOLDOWN)) return;

    // Underground: chase visible enemy
    const enemy = nearestVisibleEnemy(ant);
    if (enemy) {
        const d = dist(ant.col, ant.row, enemy.col, enemy.row);
        if (d <= CONFIG.SOLDIER_ATTACK_RANGE) {
            if (ant.attackCooldown === 0) {
                enemy.hp -= ant.damage;
                ant.attackCooldown = CONFIG.SOLDIER_ATTACK_COOLDOWN;
            }
        } else {
            ant.state = 'chase';
            const ec = Math.floor(enemy.col), er = Math.floor(enemy.row);
            if (!ant.path?.length || ant.targetCol !== ec || ant.targetRow !== er) {
                requestPathSmart(ant, ec, er);
            }
            followPath(ant);
        }
        return;
    }

    // Patrol near nest
    ant.state = 'patrol';
    if (!ant.path?.length) {
        let tc = STATE.nestCol, tr = STATE.nestRow;
        for (let attempt = 0; attempt < 30; attempt++) {
            const radius = 3 + Math.floor(Math.random() * 5);
            const angle = Math.random() * Math.PI * 2;
            const cc = Math.round(STATE.nestCol + Math.cos(angle) * radius);
            const cr = Math.round(STATE.nestRow + Math.sin(angle) * radius);
            const clamped_c = Math.max(0, Math.min(CONFIG.COLS - 1, cc));
            const clamped_r = Math.max(0, Math.min(CONFIG.ROWS - 1, cr));
            if (MapModule.isPassable(clamped_c, clamped_r)) { tc = clamped_c; tr = clamped_r; break; }
        }
        requestPathSmart(ant, tc, tr);
    }
    followPath(ant);
}
