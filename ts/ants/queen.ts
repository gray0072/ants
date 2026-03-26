import { CONFIG } from '../config';
import { STATE, Ant, QueenAnt } from '../state';
import { createAnt, requestPath, followPath, reveal, nearestVisibleEnemy, dist } from '../ant';

/** Returns the nearest free cell in the queen's chamber to her current position, 
 * or null if the chamber is full. */
export function findFreeQueenChamberSpot(): { c: number; r: number } | null {
    const { nestCol: nc, nestRow: nr } = STATE;
    const hw = CONFIG.QUEEN_CHAMBER_HALF_W;
    const hh = CONFIG.QUEEN_CHAMBER_HALF_H;
    const qc = STATE.queen ? Math.floor(STATE.queen.col) : nc;
    const qr = STATE.queen ? Math.floor(STATE.queen.row) : nr;

    const takenKeys = new Set<number>();
    takenKeys.add(nr * 100000 + nc);
    for (const a of STATE.ants) {
        if (a.lifestage) takenKeys.add(Math.floor(a.row) * 100000 + Math.floor(a.col));
    }

    const candidates: { c: number; r: number; d: number }[] = [];
    for (let dr = -hh; dr <= hh; dr++) {
        for (let dc = -hw; dc <= hw; dc++) {
            const c = nc + dc, r = nr + dr;
            const ddc = c - qc, ddr = r - qr;
            candidates.push({ c, r, d: ddc * ddc + ddr * ddr });
        }
    }
    candidates.sort((a, b) => a.d - b.d);
    for (const { c, r } of candidates) {
        if (!takenKeys.has(r * 100000 + c)) return { c, r };
    }
    return null;
}

export function freeEggsInQueenChamber(): Ant[] {
    const { nestCol, nestRow } = STATE;
    const hw = CONFIG.QUEEN_CHAMBER_HALF_W;
    const hh = CONFIG.QUEEN_CHAMBER_HALF_H;
    const reserved = new Set();
    for (const a of STATE.ants) {
        if (a.type === 'nurse') {
            if (a.carriedEgg) reserved.add(a.carriedEgg);
            if (a.targetedEgg) reserved.add(a.targetedEgg);
        }
    }
    const STAGE_ORDER: Record<string, number> = { egg: 0, larva: 1, pupa: 2 };
    return STATE.ants.filter(a =>
        a.lifestage &&
        !reserved.has(a) &&
        Math.abs(Math.floor(a.col) - nestCol) <= hw &&
        Math.abs(Math.floor(a.row) - nestRow) <= hh
    ).sort((a, b) => (STAGE_ORDER[a.lifestage!] ?? 99) - (STAGE_ORDER[b.lifestage!] ?? 99));
}

export function updateQueen(ant: QueenAnt): void {
    reveal(ant);
    if (ant.attackCooldown > 0) ant.attackCooldown--;

    // Attack nearest visible enemy if within range
    const threat = nearestVisibleEnemy(ant);
    if (threat && dist(ant.col, ant.row, threat.col, threat.row) <= CONFIG.QUEEN_ATTACK_RANGE) {
        if (ant.attackCooldown === 0) {
            threat.hp -= CONFIG.QUEEN_DAMAGE;
            ant.attackCooldown = CONFIG.QUEEN_ATTACK_COOLDOWN;
        }
        return;
    }

    // Walking to the chosen spot; lays egg on arrival and returns to idle
    if (ant.state === 'layEgg') {
        const arrived = followPath(ant);
        if (arrived) {
            const antType = ant.eggQueue?.shift();
            if (antType) {
                const newAnt = createAnt(antType, Math.floor(ant.col), Math.floor(ant.row));
                newAnt.lifestage = 'egg';
                newAnt.lifestageTick = CONFIG.EGG_TICKS;
                STATE.ants.push(newAnt);
            }
            ant.state = 'idle';
            ant.path = [];
        }
        return;
    }

    // Waiting at the throne while chamber is full; checks every tick —
    // if a spot opens up, immediately heads to lay the egg without finishing the walk
    if (ant.state === 'returnToThrone') {
        if (ant.eggQueue && ant.eggQueue.length > 0) {
            const spot = findFreeQueenChamberSpot();
            if (spot) {
                ant.state = 'layEgg';
                ant.path = [];
                requestPath(ant, spot.c, spot.r);
                return;
            }
        }
        followPath(ant);
        if (!ant.path?.length) ant.state = 'idle';
        return;
    }

    // idle: order pending and a free spot available — go lay the egg
    if (ant.eggQueue?.length) {
        const spot = findFreeQueenChamberSpot();
        if (spot) {
            ant.state = 'layEgg';
            requestPath(ant, spot.c, spot.r);
            return;
        }
    }

    // No actionable order (none, or chamber full) — return to throne and sway
    const atHome = Math.floor(ant.col) === STATE.nestCol && Math.floor(ant.row) === STATE.nestRow;
    if (!atHome) {
        ant.state = 'returnToThrone';
        requestPath(ant, STATE.nestCol, STATE.nestRow);
    } else {
        ant.angle = Math.sin(STATE.tick * 0.015) * 0.6 - Math.PI / 2;
    }
}
