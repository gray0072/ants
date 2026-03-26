import { CONFIG } from '../config';
import { STATE, Ant, NurseAnt } from '../state';
import { MapModule } from '../map';
import { reveal, requestPath, followPath } from '../ant';
import { freeEggsInQueenChamber } from './queen';

export function updateNurse(ant: NurseAnt): void {
    reveal(ant);
    if (ant.assignedChamberIdx === undefined) {
        const assigned = new Set(
            STATE.ants
                .filter(a => a.type === 'nurse' && a.assignedChamberIdx != null && a !== ant)
                .map(a => (a as NurseAnt).assignedChamberIdx as number)
        );
        for (let i = 1; i < STATE.chamberPositions.length; i++) {
            if (!assigned.has(i)) { ant.assignedChamberIdx = i; break; }
        }
    }
    const chamber = STATE.chamberPositions[ant.assignedChamberIdx!];
    if (!chamber) return;

    // Carrying egg to assigned chamber
    if (ant.carriedEgg) {
        const egg = ant.carriedEgg;
        if (!egg.lifestage || egg.hp <= 0) {
            // Hatched or died en route — release and go fetch another
            egg._carried = false;
            ant.carriedEgg = null;
            ant.path = [];
            ant.state = 'fetchEgg';
            return;
        }
        followPath(ant);
        egg.col = ant.col;  // update position AFTER nurse moves
        egg.row = ant.row;
        if (!ant.path?.length) {
            egg._carried = false;
            ant.carriedEgg = null;
            ant.state = 'waitInChamber';
        }
        return;
    }

    const eggs = freeEggsInQueenChamber();

    if (ant.state === 'fetchEgg') {
        // Reserve a target egg if we don't have one yet
        if (!ant.targetedEgg) {
            if (eggs.length > 0) {
                ant.targetedEgg = eggs[0];
                requestPath(ant, Math.floor(eggs[0].col), Math.floor(eggs[0].row));
            } else {
                ant.state = 'waitInChamber';
                ant.path = [];
            }
            return;
        }

        // Target hatched or died — release and retry next tick
        const egg = ant.targetedEgg;
        if (!egg.lifestage || egg.hp <= 0) {
            ant.targetedEgg = null;
            ant.path = [];
            return;
        }

        // Re-path if egg moved (carried by queen while we were on the way)
        const ec = Math.floor(egg.col), er = Math.floor(egg.row);
        if (!ant.path?.length) requestPath(ant, ec, er);

        const arrived = followPath(ant);
        if (arrived) {
            ant.carriedEgg = ant.targetedEgg;
            ant.carriedEgg._carried = true;
            ant.targetedEgg = null;
            // Pick random passable drop spot in chamber, excluding its center
            const R = CONFIG.CHAMBER_RADIUS;
            let tc = chamber.col, tr = chamber.row;
            for (let attempts = 0; attempts < 20; attempts++) {
                const cc = chamber.col + Math.floor(Math.random() * (2 * R + 1)) - R;
                const cr = chamber.row + Math.floor(Math.random() * (2 * R + 1)) - R;
                if (MapModule.isPassable(cc, cr) && !(cc === chamber.col && cr === chamber.row)) {
                    tc = cc; tr = cr; break;
                }
            }
            requestPath(ant, tc, tr);
        }
        return;
    }

    // waitInChamber
    if (eggs.length > 0) {
        ant.state = 'fetchEgg';
        ant.targetedEgg = null;
        ant.path = [];
        return;
    }
    // Drift within chamber while waiting
    if (ant.wanderTimer-- <= 0) {
        ant.wanderTimer = 50 + Math.floor(Math.random() * 50);
        const tc = chamber.col + Math.floor(Math.random() * 3) - 1;
        const tr = chamber.row + Math.floor(Math.random() * 3) - 1;
        if (STATE.inBounds(tc, tr) && MapModule.isPassable(tc, tr)) requestPath(ant, tc, tr);
    } else {
        followPath(ant);
    }
}
