import { CONFIG } from '../config';
import { STATE, SoldierAnt } from '../state';
import { MapModule } from '../map';
import { nearestVisibleEnemy, updateFlightGuardStates, reveal, tryAttack, chaseTarget } from '../ant';
import { requestPath, followPath } from '../path';

export function updateSoldier(ant: SoldierAnt): void {
    reveal(ant);
    if (ant.attackCooldown > 0) ant.attackCooldown--;

    if (updateFlightGuardStates(ant)) return;

    // Chase visible enemy
    const enemy = nearestVisibleEnemy(ant);
    if (enemy) {
        if (tryAttack(ant, enemy) === 'outOfRange') {
            ant.state = 'chase';
            chaseTarget(ant, enemy);
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
        requestPath(ant, tc, tr);
    }
    followPath(ant);
}
