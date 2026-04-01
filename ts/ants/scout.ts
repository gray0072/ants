import { CONFIG } from '../config';
import { STATE, ScoutAnt } from '../state';
import { MapModule } from '../map';
import { reveal } from '../ant';
import { requestPath, followPath } from '../path';

export function updateScout(ant: ScoutAnt): void {
    reveal(ant);
    if (!ant.path?.length) {
        // Go to random unrevealed area
        const { COLS, ROWS } = CONFIG;
        let tc = 0, tr = 0, attempts = 0;
        do {
            tc = Math.floor(Math.random() * COLS);
            tr = Math.floor(Math.random() * ROWS);
            attempts++;
        } while ((STATE.fog[STATE.idx(tc, tr)] > 0 || !MapModule.isPassable(tc, tr)) && attempts < 50);
        requestPath(ant, tc, tr);
    }
    followPath(ant);
}
