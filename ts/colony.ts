import { CONFIG } from './config';
import { STATE, AntType } from './state';
import { startFlight as princessStartFlight } from './ants/princess';
import { FogModule } from './fog';
import { createAnt } from './ant';
import { MapModule } from './map';
import { aiDecideAndOrder } from './ai';

let _autoSpawnTurn = 0;

function randomSpawnPos(): { c: number; r: number } {
    const positions = STATE.chamberPositions;
    const base = positions.length > 0
        ? positions[Math.floor(Math.random() * positions.length)]
        : { col: STATE.nestCol, row: STATE.nestRow };
    const isQueen = base.col === STATE.nestCol && base.row === STATE.nestRow;
    const rc = isQueen ? STATE.queenChamberHalfW : CONFIG.CHAMBER_RADIUS;
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
    return nurseCount < STATE.chambers - 1;
}

function setAntsCount(type: AntType, toAmount: number): void {
    STATE.ants = STATE.ants.filter(a => a.type !== type)
    for (let i = 0; i < toAmount; i++) {
        const { c, r } = randomSpawnPos();
        STATE.ants.push(createAnt(type, c, r));
    }
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
        _autoSpawnTurn = 0;
        STATE.ants.length = 0;
        STATE.chamberPositions.length = 0;
        // Place queen
        const queen = createAnt('queen', STATE.nestCol, STATE.nestRow);
        STATE.ants.push(queen);
        STATE.queen = queen;

        // Register initial queen chamber
        STATE.chamberPositions.push({ col: STATE.nestCol, row: STATE.nestRow });

        // Starting ants are free — founding colony
        setAntsCount('worker', CONFIG.START_WORKERS);
        setAntsCount('soldier', CONFIG.START_SOLDIERS);
        setAntsCount('scout', CONFIG.START_SCOUTS);
    },

    initPerfDebug(): void {
        MapModule.expandSurfaceFull();
        this.digAllChambers();
        setAntsCount('worker', 300);
        setAntsCount('soldier', 100);
        setAntsCount('scout', 10);
        setAntsCount('nurse', STATE.chambers - 1);
        setAntsCount('princess', CONFIG.PRINCESS_LIMIT);
        STATE.wave = 80;
        STATE.autoAI = false;
    },

    setAntsCount(type: AntType, toAmount: number): void {
        setAntsCount(type, toAmount);
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
        // 1st chamber is queen's
        if (STATE.chambers > 2 && STATE.chambers % CONFIG.CHAMBERS_PER_FLOOR === 2) {
            STATE.queenChamberHalfW += CONFIG.QUEEN_CHAMBER_HALF_W_STEP;
            MapModule.carveRect(nestCol - STATE.queenChamberHalfW, nestRow - CONFIG.QUEEN_CHAMBER_HALF_H, 2 * STATE.queenChamberHalfW + 1, 2 * CONFIG.QUEEN_CHAMBER_HALF_H + 1, 'chamber');
            FogModule.revealArea(nestCol, cr, 7);
        }
        return true;
    },

    canDigChamber(): boolean {
        return getChamberSlot(STATE.chambers + 1) !== null;
    },

    digAllChambers(): void {
        STATE.food = 999_999;
        while (this.canDigChamber()) { this.digChamber(); STATE.food = 999_999; }
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

    update(): void {
        // Update cached queries for UI and auto-logic
        STATE.canDigChamber = getChamberSlot(STATE.chambers + 1) !== null;
        STATE.canSpawnNurse = canSpawnNurse();
        STATE.canSpawnPrincess = canSpawnPrincess();

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

        // Auto-actions
        if (!STATE.running || !STATE.queen) return;

        if (STATE.autoBuild.chamber && STATE.canDigChamber && STATE.food >= STATE.chamberCost()) {
            this.digChamber();
        }
        if (STATE.autoBuild.expand && STATE.surfaceRows < CONFIG.SURFACE_ROWS_MAX && STATE.food >= STATE.expandCost()) {
            MapModule.expandSurface();
        }
        if (STATE.autoAction.flight) this.startFlight();

        if ((STATE.queen.eggQueue?.length ?? 0) > 0) return;

        if (STATE.autoAI) {
            aiDecideAndOrder();
        } else {
            const types = (['worker', 'soldier', 'scout', 'nurse', 'princess'] as const).filter(t => STATE.autoSpawn[t]);
            if (types.length === 0) return;

            _autoSpawnTurn = _autoSpawnTurn % types.length;
            let type = types[_autoSpawnTurn];

            if (type === 'nurse' && !STATE.canSpawnNurse) {
                _autoSpawnTurn = (_autoSpawnTurn + 1) % types.length;
                type = types[_autoSpawnTurn];
                if (type === 'nurse') return;
            }
            if (type === 'princess' && !STATE.canSpawnPrincess) {
                _autoSpawnTurn = (_autoSpawnTurn + 1) % types.length;
                type = types[_autoSpawnTurn];
                if (type === 'princess') return;
            }

            if (this.orderAnt(type)) {
                _autoSpawnTurn = (_autoSpawnTurn + 1) % types.length;
            }
        }
    },
};