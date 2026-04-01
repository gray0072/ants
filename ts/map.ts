import { CONFIG } from './config';
import { STATE, CellType } from './state';
import { FogModule } from './fog';
import { invalidatePathCache } from './path';

export const MapModule = {
    carve(col: number, row: number, type: CellType): void {
        if (!STATE.inBounds(col, row)) return;
        STATE.map[STATE.idx(col, row)] = type;
    },

    carveRect(c: number, r: number, w: number, h: number, type: CellType): void {
        for (let dr = 0; dr < h; dr++) {
            for (let dc = 0; dc < w; dc++) {
                this.carve(c + dc, r + dr, type);
            }
        }
    },

    carveTunnel(c0: number, r0: number, c1: number, r1: number): void {
        let c = c0, r = r0;
        while (c !== c1) {
            this.carve(c, r, 'tunnel');
            c += c < c1 ? 1 : -1;
        }
        while (r !== r1) {
            this.carve(c, r, 'tunnel');
            r += r < r1 ? 1 : -1;
        }
        this.carve(c, r, 'tunnel');
    },

    init(): void {
        invalidatePathCache();
        const { COLS } = CONFIG;

        // Surface strip at top (dynamic depth)
        const surf = STATE.surfaceRows;
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < surf; r++) {
                this.carve(c, r, 'surface');
            }
        }

        // Nest below current surface
        const nc = Math.floor(COLS / 2);
        const nr = STATE.surfaceRows + CONFIG.NEST_DEPTH;
        STATE.nestCol = nc;
        STATE.nestRow = nr;

        // Queen chamber
        const qhw = STATE.queenChamberHalfW;
        const qhh = CONFIG.QUEEN_CHAMBER_HALF_H;
        this.carveRect(nc - qhw, nr - qhh, 2 * qhw + 1, 2 * qhh + 1, 'chamber');

        // Main vertical tunnel — goes all the way to row 0 so surface expansion always connects
        this.carveTunnel(nc, nr, nc, 0);

        // Place food sources on current surface
        this.placeFood();

        // Reveal nest area and the main tunnel to surface
        FogModule.revealArea(nc, nr, 8);
        for (let r = surf - 1; r <= nr; r++) FogModule.revealArea(nc, r, 2);
        FogModule.revealArea(nc, Math.floor(surf / 2), 8);
    },

    foodSourceCount(): number {
        return Math.round(CONFIG.FOOD_PER_SURFACE_ROW * STATE.surfaceRows);
    },

    regenCellCount(): number {
        return Math.max(1, Math.round(CONFIG.FOOD_REGEN_PER_SURFACE_ROW * STATE.surfaceRows));
    },

    placeFood(): void {
        const { COLS, FOOD_AMOUNT } = CONFIG;
        const surf = STATE.surfaceRows;
        const count = this.foodSourceCount();
        let placed = 0, attempts = 0;
        while (placed < count && attempts < count * 10) {
            attempts++;
            const c = Math.floor(Math.random() * COLS);
            const r = Math.floor(Math.random() * surf);
            const i = STATE.idx(c, r);
            if (STATE.foodGrid[i] === 0) {
                STATE.foodGrid[i] = FOOD_AMOUNT + Math.floor(Math.random() * FOOD_AMOUNT);
                STATE.foodCells.add(i);
                placed++;
            }
        }
    },

    isPassable(col: number, row: number): boolean {
        if (!STATE.inBounds(col, row)) return false;
        const t = STATE.map[STATE.idx(col, row)];
        return t !== 'soil';
    },

    regenerateFood(): void {
        const { COLS, FOOD_REGEN_AMOUNT, FOOD_MAX } = CONFIG;
        const surf = STATE.surfaceRows;
        const cells = this.regenCellCount();
        for (let n = 0; n < cells; n++) {
            const c = Math.floor(Math.random() * COLS);
            const r = Math.floor(Math.random() * surf);
            const i = STATE.idx(c, r);
            if (STATE.foodGrid[i] < FOOD_MAX) {
                STATE.foodGrid[i] = Math.min(FOOD_MAX, STATE.foodGrid[i] + FOOD_REGEN_AMOUNT);
                STATE.foodCells.add(i);
            }
        }
    },

    expandSurface(): boolean {
        if (STATE.surfaceRows >= CONFIG.SURFACE_ROWS_MAX) return false;
        const cost = STATE.expandCost();
        if (STATE.food < cost) return false;
        STATE.food -= cost;

        const { COLS, ROWS, FOOD_AMOUNT, FOOD_PER_SURFACE_ROW } = CONFIG;
        const size = COLS * ROWS;

        // Shift all grids down by 1 row
        for (let i = size - 1; i >= COLS; i--) {
            STATE.map[i] = STATE.map[i - COLS];
            STATE.foodGrid[i] = STATE.foodGrid[i - COLS];
            STATE.fog[i] = STATE.fog[i - COLS];
        }

        // Fill new top row as revealed surface
        for (let c = 0; c < COLS; c++) {
            STATE.map[c] = 'surface';
            STATE.foodGrid[c] = 0;
            STATE.fog[c] = 0;
        }

        // Shift all ants positions
        for (const a of STATE.ants) {
            a.row += 1;
            if (a.targetRow != null) a.targetRow += 1;
            if (a.path) for (const wp of a.path) wp[1] += 1;
        }

        // Shift all enemies
        for (const e of STATE.enemies) {
            e.row += 1;
            if (e.targetRow != null) e.targetRow += 1;
            if (e.path) for (const wp of e.path) wp[1] += 1;
        }

        // Shift nest anchor and chamber positions
        STATE.nestRow += 1;
        STATE.surfaceRows += 1;
        invalidatePathCache();
        for (const ch of STATE.chamberPositions) ch.row += 1;

        // Rebuild foodCells index
        STATE.foodCells.clear();
        for (let i = 0; i < size; i++) {
            if (STATE.foodGrid[i] > 0) STATE.foodCells.add(i);
        }

        // Place food on the new top row and index it
        for (let n = 0; n < FOOD_PER_SURFACE_ROW * 3; n++) {
            const c = Math.floor(Math.random() * COLS);
            const i = c; // row 0
            if (STATE.foodGrid[i] === 0) {
                STATE.foodGrid[i] = FOOD_AMOUNT + Math.floor(Math.random() * FOOD_AMOUNT);
                STATE.foodCells.add(i);
            }
        }

        return true;
    },

    expandSurfaceFull(): void {
        STATE.food = 999_999;
        while (this.expandSurface()) STATE.food = 999_999;
    },
};