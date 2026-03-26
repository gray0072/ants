import { CONFIG } from './config';
import { STATE, AntType } from './state';
import { startFlight as princessStartFlight } from './ants/princess';
import { FogModule } from './fog';
import { createAnt } from './ant';
import { MapModule } from './map';

function randomSpawnPos(): { c: number; r: number } {
    const positions = STATE.chamberPositions;
    const base = positions.length > 0
        ? positions[Math.floor(Math.random() * positions.length)]
        : { col: STATE.nestCol, row: STATE.nestRow };
    const isQueen = base.col === STATE.nestCol && base.row === STATE.nestRow;
    const rc = isQueen ? CONFIG.QUEEN_CHAMBER_HALF_W : CONFIG.CHAMBER_RADIUS;
    const rr = isQueen ? CONFIG.QUEEN_CHAMBER_HALF_H : CONFIG.CHAMBER_RADIUS;
    return {
        c: base.col + Math.floor(Math.random() * (2 * rc + 1)) - rc,
        r: base.row + Math.floor(Math.random() * (2 * rr + 1)) - rr,
    };
}

function canSpawnPrincess(): boolean {
    const maxChambers = CONFIG.CHAMBER_FLOORS * CONFIG.CHAMBERS_PER_FLOOR + 1;
    if (STATE.chambers < maxChambers) return false;
    if (STATE.surfaceRows < CONFIG.SURFACE_ROWS_MAX) return false;
    const count = STATE.ants.filter(a => a.type === 'princess').length
        + (STATE.queen?.eggQueue ?? []).filter(o => o === 'princess').length;
    return count < CONFIG.PRINCESS_LIMIT;
}

function canSpawnNurse(): boolean {
    const nurseCount = STATE.ants.filter(a => a.type === 'nurse').length
        + (STATE.queen?.eggQueue ?? []).filter(o => o === 'nurse').length;
    return nurseCount < STATE.chamberPositions.length - 1;
}

function getChamberSlot(n: number): { cc: number; cr: number; floorRow: number } | null {
    if (n <= 1) return null;

    const { nestCol, nestRow } = STATE;
    const { CHAMBER_STEP, CHAMBER_FLOOR_STEP, CHAMBER_VOFFSET, CHAMBERS_PER_FLOOR, CHAMBER_FLOORS } = CONFIG;

    const i = n - 2;
    const floorIdx = Math.floor(i / CHAMBERS_PER_FLOOR);
    const posInFloor = i % CHAMBERS_PER_FLOOR;

    if (floorIdx >= CHAMBER_FLOORS) return null;

    const floorRow = nestRow + floorIdx * CHAMBER_FLOOR_STEP;
    if (floorRow < 2 || floorRow > CONFIG.ROWS - 3) return null;

    const rank = Math.floor(posInFloor / 2) + 1;
    const side = (posInFloor % 2 === 0) ? 1 : -1;
    const cc = nestCol + rank * CHAMBER_STEP * side;
    const cr = floorRow + CHAMBER_VOFFSET;

    if (cc < 2 || cc > CONFIG.COLS - 3) return null;
    if (cr < 2 || cr > CONFIG.ROWS - 3) return null;

    return { cc, cr, floorRow };
}

export const ColonyModule = {
    init(): void {
        // Place queen
        const queen = createAnt('queen', STATE.nestCol, STATE.nestRow);
        STATE.ants.push(queen);
        STATE.queen = queen;

        // Register initial queen chamber
        STATE.chamberPositions.push({ col: STATE.nestCol, row: STATE.nestRow });

        // Starting ants are free — founding colony
        for (let i = 0; i < CONFIG.START_WORKERS; i++) {
            const { c, r } = randomSpawnPos();
            STATE.ants.push(createAnt('worker', c, r));
        }
        for (let i = 0; i < CONFIG.START_SOLDIERS; i++) {
            const { c, r } = randomSpawnPos();
            STATE.ants.push(createAnt('soldier', c, r));
        }
        for (let i = 0; i < CONFIG.START_SCOUTS; i++) {
            const { c, r } = randomSpawnPos();
            STATE.ants.push(createAnt('scout', c, r));
        }
    },

    orderAnt(type: AntType): boolean {
        const pending = (STATE.queen?.eggQueue ?? []).length;
        if (STATE.ants.length + pending >= STATE.popCap()) return false;
        const cost: Partial<Record<AntType, number>> = {
            worker: CONFIG.COST_WORKER,
            soldier: CONFIG.COST_SOLDIER,
            scout: CONFIG.COST_SCOUT,
            nurse: CONFIG.COST_NURSE,
            princess: CONFIG.COST_PRINCESS,
        };
        const c = cost[type];
        if (c == null || STATE.food < c) return false;
        if (type === 'nurse' && !canSpawnNurse()) return false;
        if (type === 'princess' && !canSpawnPrincess()) return false;

        if (!STATE.queen) return false;
        const queen = STATE.queen;

        STATE.food -= c;
        queen.eggQueue!.push(type);
        return true;
    },

    digChamber(): boolean {
        const slot = getChamberSlot(STATE.chambers + 1);
        if (!slot) return false;
        const cost = STATE.chamberCost();
        if (STATE.food < cost) return false;

        STATE.food -= cost;
        STATE.chambers++;

        const { cc, cr, floorRow } = slot;
        const { nestCol, nestRow } = STATE;

        // Vertical shaft at nestCol from nestRow down to this floor's corridor
        for (let r = nestRow + 1; r <= floorRow; r++) {
            if (STATE.inBounds(nestCol, r) && STATE.map[STATE.idx(nestCol, r)] !== 'chamber')
                STATE.map[STATE.idx(nestCol, r)] = 'tunnel';
        }

        // Horizontal corridor at floorRow from nestCol to cc
        const hstep = cc > nestCol ? 1 : -1;
        for (let c = nestCol; c !== cc + hstep; c += hstep) {
            if (STATE.inBounds(c, floorRow) && STATE.map[STATE.idx(c, floorRow)] !== 'chamber')
                STATE.map[STATE.idx(c, floorRow)] = 'tunnel';
        }

        // 2-cell tunnel connector from corridor down to room (floorRow+1, floorRow+2)
        for (let r = floorRow + 1; r < cr; r++) {
            if (STATE.inBounds(cc, r) && STATE.map[STATE.idx(cc, r)] !== 'chamber')
                STATE.map[STATE.idx(cc, r)] = 'tunnel';
        }

        // chamber room
        const R = CONFIG.CHAMBER_RADIUS;
        for (let dr = -R; dr <= R; dr++) {
            for (let dc = -R; dc <= R; dc++) {
                const nc = cc + dc, nr = cr + dr;
                if (STATE.inBounds(nc, nr)) STATE.map[STATE.idx(nc, nr)] = 'chamber';
            }
        }

        STATE.chamberPositions.push({ col: cc, row: cr });
        FogModule.revealArea(cc, cr, 7);
        if (STATE.chambers % CONFIG.CHAMBERS_PER_FLOOR === 1) {
            FogModule.revealArea(nestCol, cr, 7);
        }
        STATE.nestFlowDirty = true;
        return true;
    },

    canDigChamber(): boolean {
        return getChamberSlot(STATE.chambers + 1) !== null;
    },

    startFlight(): boolean {
        return princessStartFlight();
    },

    canSpawnNurse(): boolean {
        return canSpawnNurse();
    },

    canSpawnPrincess(): boolean {
        return canSpawnPrincess();
    },

    initPerfDebug(): void {
        // Expand surface to max
        STATE.food = 999_999;
        while (STATE.surfaceRows < CONFIG.SURFACE_ROWS_MAX) {
            MapModule.expandSurface();
            STATE.food = 999_999;
        }

        // Dig all possible chambers
        while (this.canDigChamber()) {
            STATE.food = 999_999;
            this.digChamber();
        }

        // Reveal entire map fog
        //if (STATE.fog) STATE.fog.fill(1);

        // Spawn ants directly, bypassing pop cap and egg queue
        const nc = STATE.nestCol, nr = STATE.nestRow;
        for (let i = 0; i < 100; i++)
            STATE.ants.push(createAnt('soldier', nc, nr));

        const maxNurses = STATE.chamberPositions.length - 1;
        for (let i = 0; i < maxNurses; i++)
            STATE.ants.push(createAnt('nurse', nc, nr));

        for (let i = 0; i < 300; i++)
            STATE.ants.push(createAnt('worker', nc, nr));

        for (let i = 0; i < 10; i++)
            STATE.ants.push(createAnt('scout', nc, nr));

        for (let i = 0; i < CONFIG.PRINCESS_LIMIT; i++)
            STATE.ants.push(createAnt('princess', nc, nr));

        STATE.wave = 50;
    },

    update(): void {
        const antCount = STATE.ants.length;

        // Upkeep
        STATE.upkeepTimer++;
        if (STATE.upkeepTimer >= CONFIG.COLONY_UPKEEP_INTERVAL) {
            STATE.upkeepTimer = 0;
            STATE.food -= antCount * CONFIG.COLONY_UPKEEP_PER_ANT;
            if (STATE.food < 0) STATE.food = 0;
        }

        // Flight completion: all princesses have flown away or been killed
        const stillInFlight = STATE.flightStarted && STATE.ants.some(
            a => a.type === 'princess' && a.lifestage === null
                && (a.state === 'fly' || a.state === 'surface' || a.state === 'prepare')
        );
        if (STATE.flightStarted && STATE.flightTotal > 0
            && (STATE.flightEscaped >= STATE.flightTotal || !stillInFlight)) {
            STATE.completedFlights++;
            STATE.flightStarted = false;
            STATE.flightEscaped = 0;
            STATE.flightTotal = 0;
            if (!STATE.survival) {
                STATE.over = true;
                STATE.won = true;
                STATE.running = false;
            }
        }
    },
};