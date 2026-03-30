import { BufferImageSource } from 'pixi.js';
import { CONFIG } from '../config';
import { STATE, CellType } from '../state';
import { CELL, MAP_W, MAP_H, pack } from './constants';
import { hasIntroData } from './intro';

// ─── Terrain noise (pre-baked at init) ───────────────────────────────────────

let _pixelNoise: Int8Array;    // smooth+grain noise per pixel  [−127..127]
let _cellNoise: Float32Array; // per-cell brightness variation [0.90..1.10]

// Two-buffer map system: _litBuf32 = base colors (no fog), rebuilt only on cell type change.
// _mapBuf32 is updated only for cells whose fog value changed → zero pixel work on static frames.
let _litBuf32: Uint32Array;
let _prevFog: Float32Array;       // fog per cell from last frame (−1 = not yet rendered)
let _prevCellType: Uint8Array;    // encoded cell type from last frame (0 = unset)
const _CELL_ID: Record<string, number> = { soil: 1, surface: 2, tunnel: 3, chamber: 4 };

let _mapBuf32: Uint32Array;
let _mapSrc: BufferImageSource;

function initNoise(): void {
    const G1 = 10, G2 = 4;

    const gw1 = Math.ceil(MAP_W / G1) + 2;
    const gw2 = Math.ceil(MAP_W / G2) + 2;
    const grid1 = new Float32Array((Math.ceil(MAP_H / G1) + 2) * gw1);
    const grid2 = new Float32Array((Math.ceil(MAP_H / G2) + 2) * gw2);
    for (let i = 0; i < grid1.length; i++) grid1[i] = Math.random() * 2 - 1;
    for (let i = 0; i < grid2.length; i++) grid2[i] = Math.random() * 2 - 1;

    function sample(grid: Float32Array, gw: number, gx: number, gy: number): number {
        const gxi = gx | 0, gyi = gy | 0;
        const fx = gx - gxi, fy = gy - gyi;
        const sfx = fx * fx * (3 - 2 * fx), sfy = fy * fy * (3 - 2 * fy);
        const v00 = grid[gyi * gw + gxi];
        const v10 = grid[gyi * gw + gxi + 1];
        const v01 = grid[(gyi + 1) * gw + gxi];
        const v11 = grid[(gyi + 1) * gw + gxi + 1];
        return v00 + (v10 - v00) * sfx + (v01 - v00) * sfy + (v00 - v10 - v01 + v11) * sfx * sfy;
    }

    _pixelNoise = new Int8Array(MAP_W * MAP_H);
    for (let py = 0; py < MAP_H; py++) {
        for (let px = 0; px < MAP_W; px++) {
            const s1 = sample(grid1, gw1, px / G1, py / G1);
            const s2 = sample(grid2, gw2, px / G2, py / G2);
            let h = Math.imul(px * 374761393 ^ py * 668265263, 1274126177);
            h = Math.imul(h ^ (h >>> 16), 2246822519);
            const grain = ((h >>> 24) / 127.5) - 1.0;
            const v = s1 * 0.55 + s2 * 0.30 + grain * 0.15;
            _pixelNoise[py * MAP_W + px] = Math.max(-127, Math.min(127, (v * 32) | 0));
        }
    }

    _cellNoise = new Float32Array(CONFIG.COLS * CONFIG.ROWS);
    for (let i = 0; i < _cellNoise.length; i++) {
        _cellNoise[i] = 0.90 + Math.random() * 0.20;
    }
}

// Bake fully-lit (fog-free) pixel colors for one cell into _litBuf32.
// Called once per cell at first render, then only when the cell type changes.
function buildLitCell(col: number, row: number): void {
    const { COLS } = CONFIG;
    const ci = row * COLS + col;
    const ct = STATE.map[ci] as CellType;
    const cn = _cellNoise[ci];
    const depthScale = Math.max(1, CONFIG.ROWS - CONFIG.SURFACE_ROWS_START);
    const depthT = ct === 'surface' ? 0 : Math.max(0, (row - CONFIG.SURFACE_ROWS_START) / depthScale);
    const halfC = CELL / 2;
    const x0 = col * CELL, y0 = row * CELL;

    for (let py = 0; py < CELL; py++) {
        for (let px = 0; px < CELL; px++) {
            const pidx = (y0 + py) * MAP_W + (x0 + px);
            const n = _pixelNoise[pidx];
            let br: number, bg: number, bb: number;
            switch (ct) {
                case 'soil': {
                    const d = (1.0 - depthT * 0.18) * cn;
                    br = (0x3e * d + n * 1.10) | 0;
                    bg = (0x2c * d + n * 0.85) | 0;
                    bb = (0x1a * d + n * 0.60) | 0;
                    break;
                }
                case 'surface': {
                    br = (0x72 * cn + n * 1.25) | 0;
                    bg = (0x52 * cn + n * 0.95) | 0;
                    bb = (0x2d * cn + n * 0.65) | 0;
                    break;
                }
                case 'tunnel': {
                    const ex = Math.min(px, CELL - 1 - px) / halfC;
                    const ey = Math.min(py, CELL - 1 - py) / halfC;
                    const edge = (0.88 + Math.min(ex, ey) * 0.18) * cn;
                    br = (0x85 * edge + n * 0.75) | 0;
                    bg = (0x64 * edge + n * 0.60) | 0;
                    bb = (0x3f * edge + n * 0.45) | 0;
                    break;
                }
                case 'chamber': {
                    const ex = Math.min(px, CELL - 1 - px) / halfC;
                    const ey = Math.min(py, CELL - 1 - py) / halfC;
                    const edge = (0.90 + Math.min(ex, ey) * 0.14) * cn;
                    br = (0x96 * edge + n * 0.60) | 0;
                    bg = (0x72 * edge + n * 0.48) | 0;
                    bb = (0x48 * edge + n * 0.35) | 0;
                    break;
                }
                default:
                    br = bg = bb = 0;
            }
            if (br < 0) br = 0; else if (br > 255) br = 255;
            if (bg < 0) bg = 0; else if (bg > 255) bg = 255;
            if (bb < 0) bb = 0; else if (bb > 255) bb = 255;
            _litBuf32[pidx] = pack(br, bg, bb);
        }
    }
}

export function initMap(mapBuf32: Uint32Array, mapSrc: BufferImageSource): void {
    _mapBuf32 = mapBuf32;
    _mapSrc = mapSrc;
    initNoise();
    _litBuf32 = new Uint32Array(MAP_W * MAP_H);
    _prevFog = new Float32Array(CONFIG.COLS * CONFIG.ROWS).fill(-1);
    _prevCellType = new Uint8Array(CONFIG.COLS * CONFIG.ROWS); // 0 = unset
}

export function updateMap(): void {
    const { COLS, ROWS } = CONFIG;
    const fog = STATE.fog!;
    if (!fog) return;

    let dirty = false;

    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const ci = row * COLS + col;
            const ctId = _CELL_ID[STATE.map[ci]] ?? 0;
            const fogV = hasIntroData() ? 1 : fog[ci];

            // Rebuild lit pixels only when cell type changes (e.g. tunnel dug).
            if (_prevCellType[ci] !== ctId) {
                buildLitCell(col, row);
                _prevCellType[ci] = ctId;
                _prevFog[ci] = -1; // force fog re-apply this frame
            }

            // Skip if fog hasn't changed since last frame.
            if (fogV === _prevFog[ci]) continue;
            _prevFog[ci] = fogV;
            dirty = true;

            const x0 = col * CELL, y0 = row * CELL;
            if (fogV >= 1) {
                // Fully revealed: fast typed-array copy from lit buffer.
                for (let py = 0; py < CELL; py++) {
                    const off = (y0 + py) * MAP_W + x0;
                    _mapBuf32.set(_litBuf32.subarray(off, off + CELL), off);
                }
            } else {
                // Partial or full fog: darken lit pixels toward black.
                const ia = 1 - 0.82 * (1 - fogV);
                for (let py = 0; py < CELL; py++) {
                    for (let px = 0; px < CELL; px++) {
                        const pidx = (y0 + py) * MAP_W + (x0 + px);
                        const b = _litBuf32[pidx];
                        _mapBuf32[pidx] = pack(
                            ((b & 0xff) * ia + 0.5) | 0,
                            ((b >> 8 & 0xff) * ia + 0.5) | 0,
                            ((b >> 16 & 0xff) * ia + 0.5) | 0,
                        );
                    }
                }
            }
        }
    }
    if (dirty) _mapSrc.update();
}
