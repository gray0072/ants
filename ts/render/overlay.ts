import { Graphics } from 'pixi.js';
import { CONFIG } from '../config';
import { STATE, AntType } from '../state';
import { CELL, ANT_HEX } from './constants';

let _foodG: Graphics;
let _overlay: Graphics;

export function createOverlayGraphics(): { foodG: Graphics; overlay: Graphics } {
    _foodG = new Graphics();
    _overlay = new Graphics();
    return { foodG: _foodG, overlay: _overlay };
}

export function updateFood(): void {
    const g = _foodG;
    g.clear();
    const { COLS, ROWS, FOOD_MAX } = CONFIG;
    const food = STATE.foodGrid;
    const fog = STATE.fog;
    if (!food) return;

    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const i = row * COLS + col;
            const fv = food[i];
            if (fv <= 0) continue;
            const fogV = fog ? fog[i] : 1;
            if (fogV <= 0) continue;

            const t = Math.sqrt(Math.min(1, fv / FOOD_MAX));  // perceptual scale
            const fa = Math.min(1, fogV * 2);                   // fade in as fog lifts

            // Slight per-cell position jitter so pellets don't sit dead-centre
            const h = (col * 1234 ^ row * 5678) & 0xff;
            const ox = ((h & 0x0f) - 7.5) / 7.5 * CELL * 0.14;
            const oy = ((h >> 4) - 7.5) / 7.5 * CELL * 0.14;
            const cx = col * CELL + CELL * 0.5 + ox;
            const cy = row * CELL + CELL * 0.5 + oy;
            const r = CELL * (0.14 + t * 0.30);

            // Soft glow halo
            g.circle(cx, cy, r * 2.4).fill({ color: 0x44ee00, alpha: 0.10 * t * fa });
            // Drop shadow
            g.circle(cx + r * 0.14, cy + r * 0.18, r * 0.90).fill({ color: 0x1e5c08, alpha: 0.80 * fa });
            // Main body
            g.circle(cx, cy, r).fill({ color: 0x5ecf22, alpha: fa });
            // Specular highlight
            g.circle(cx - r * 0.30, cy - r * 0.28, r * 0.36).fill({ color: 0xccff88, alpha: 0.65 * fa });
        }
    }
}

export function updateOverlay(): void {
    const g = _overlay;
    const fog = STATE.fog;
    g.clear();

    // Nest marker
    const nx = STATE.nestCol * CELL + CELL / 2;
    const ny = STATE.nestRow * CELL + CELL / 2;
    g.circle(nx, ny, CELL * 2.5)
        .stroke({ color: 0xc864dc, alpha: 0.60, width: 1.5 });

    // Carried items (food pellets, nurse eggs)
    for (const ant of STATE.ants) {
        if (ant._carried || ant.lifestage) continue;
        const col = Math.round(ant.col), row = Math.round(ant.row);
        if (fog && STATE.inBounds(col, row) && fog[STATE.idx(col, row)] <= 0) continue;

        const r = (ant.type === 'queen' || ant.type === 'princess') ? CELL * 0.55 : CELL * 0.38;
        const θ = (ant.angle ?? -Math.PI / 2) + Math.PI / 2;
        const cosθ = Math.cos(θ), sinθ = Math.sin(θ);

        if (ant.carrying > 0) {
            // local (0, -r*1.42) → world
            const wx = r * 1.42 * sinθ + ant.col * CELL;
            const wy = -r * 1.42 * cosθ + ant.row * CELL;
            g.circle(wx, wy, r * 0.38).fill({ color: 0xaaff44, alpha: 0.35 });
            g.circle(wx, wy, r * 0.22).fill(0x80c840);
            g.ellipse(wx - r * 0.07, wy - r * 0.06, r * 0.08, r * 0.06)
                .fill({ color: 0xffffff, alpha: 0.50 });
        }
        if (ant.type === 'nurse' && ant.carriedEgg) {
            const wx = r * 1.55 * sinθ + ant.col * CELL;
            const wy = -r * 1.55 * cosθ + ant.row * CELL;
            const ec = ANT_HEX[ant.carriedEgg.type as AntType] ?? 0xffffff;
            g.ellipse(wx, wy, CELL * 0.14, CELL * 0.19).fill({ color: ec, alpha: 0.92 });
        }
    }

    // HP bars — ants
    for (const ant of STATE.ants) {
        if (ant._carried || ant.hp >= ant.maxHp) continue;
        const col = Math.round(ant.col), row = Math.round(ant.row);
        if (fog && STATE.inBounds(col, row) && fog[STATE.idx(col, row)] <= 0) continue;
        const r = (ant.type === 'queen' || ant.type === 'princess') ? CELL * 0.55 : CELL * 0.38;
        const bw = CELL * 1.2, bh = 2;
        const bx = ant.col * CELL - bw / 2, by = ant.row * CELL - r - 6;
        g.rect(bx, by, bw, bh).fill(0x550000);
        g.rect(bx, by, bw * (ant.hp / ant.maxHp), bh).fill(0x00ee00);
    }

    // HP bars — enemies
    for (const e of STATE.enemies) {
        if (e.hp >= e.maxHp) continue;
        const col = Math.floor(e.col), row = Math.floor(e.row);
        if (fog && STATE.inBounds(col, row) && fog[STATE.idx(col, row)] <= 0) continue;
        const r = CELL * 0.45;
        const bw = CELL * 1.2, bh = 2;
        const bx = e.col * CELL - bw / 2, by = e.row * CELL - r - 5;
        g.rect(bx, by, bw, bh).fill(0x550000);
        g.rect(bx, by, bw * (e.hp / e.maxHp), bh).fill(0xff5500);
    }
}
