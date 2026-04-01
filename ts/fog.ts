import { CONFIG } from './config';
import { STATE } from './state';

// Pre-allocated buffer for ant presence checks — avoids Set allocation per shrinkFog call
const _antPresence = new Uint8Array(CONFIG.COLS * CONFIG.ROWS);

export const FogModule = {
    // Reveal a circular area. Inner cells (dist < radius) become fully visible;
    // the outermost ring (dist == radius) opens to FOG_EDGE_VISIBILITY (half-shadow).
    revealArea(col: number, row: number, radius: number): void {
        const { FOG_EDGE_VISIBILITY } = CONFIG;
        const innerR2 = (radius - 1) * (radius - 1);
        const outerR2 = radius * radius;
        for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
                const dist2 = dc * dc + dr * dr;
                if (dist2 > outerR2) continue;
                const c = col + dc, r = row + dr;
                if (!STATE.inBounds(c, r)) continue;
                const i = STATE.idx(c, r);
                const target = dist2 <= innerR2 ? 1 : FOG_EDGE_VISIBILITY;
                if (STATE.fog[i] < target) STATE.fog[i] = target;
            }
        }
    },

    // Gradually fade surface fog. Called every FOG_SHRINK_INTERVAL ticks;
    // a fully-visible cell reaches 0 after FOG_FADE_TICKS total ticks.
    shrinkFog(): void {
        const { COLS, FOG_SHRINK_INTERVAL, FOG_FADE_TICKS } = CONFIG;
        const fog = STATE.fog;
        const surf = STATE.surfaceRows;
        const step = FOG_SHRINK_INTERVAL / FOG_FADE_TICKS;

        // Mark cells occupied by ants using pre-allocated buffer (no Set allocation)
        const surfMax = surf * COLS;
        _antPresence.fill(0, 0, surfMax);
        for (const a of STATE.ants) {
            const ac = Math.floor(a.col), ar = Math.floor(a.row);
            if (ar < surf && ac >= 0 && ac < COLS) _antPresence[STATE.idx(ac, ar)] = 1;
        }

        for (let i = 0; i < surfMax; i++) {
            if (fog[i] <= 0) continue;
            if (STATE.map[i] !== 'surface') continue;
            if (_antPresence[i]) continue;
            fog[i] = Math.max(0, fog[i] - step);
        }
    },
};
