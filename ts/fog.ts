import { CONFIG } from './config';
import { STATE } from './state';

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
                if (!STATE.inBounds(c, r) || !STATE.fog) continue;
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
        if (!fog) return;
        const surf = STATE.surfaceRows;
        const step = FOG_SHRINK_INTERVAL / FOG_FADE_TICKS;

        const antPositions = new Set<number>();
        for (const a of STATE.ants) {
            const ac = Math.floor(a.col), ar = Math.floor(a.row);
            if (ar < surf) antPositions.add(STATE.idx(ac, ar));
        }

        for (let r = 0; r < surf; r++) {
            for (let c = 0; c < COLS; c++) {
                const i = STATE.idx(c, r);
                if (fog[i] <= 0) continue;
                if (STATE.map[i] !== 'surface') continue;
                if (antPositions.has(i)) continue;
                fog[i] = Math.max(0, fog[i] - step);
            }
        }
    },
};
