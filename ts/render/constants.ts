import { CONFIG } from '../config';
import { AntType } from '../state';

// ─── Layout constants ─────────────────────────────────────────────────────────

export const CELL = CONFIG.CELL;
export const MAP_W = CONFIG.COLS * CELL;
export const MAP_H = CONFIG.ROWS * CELL;

// Sprites are pre-rendered at 2× game pixels for crisp sub-pixel detail,
// then displayed at DISP (0.5×) so they occupy the correct game area.
export const DRAW_SCALE = 2;
export const DISP = 1 / DRAW_SCALE;

// Ant sprite canvas (pixels at DRAW_SCALE).
// Body/thorax junction sits at ANT_CX, ANT_CY within the texture.
export const ANT_W = 48;
export const ANT_H = 64;
export const ANT_CX = ANT_W / 2;          // 24
export const ANT_CY = ANT_H * 0.625;      // 40  (leaves ~24 px above for antennae)
export const ANT_AY = ANT_CY / ANT_H;     // anchor Y fraction ≈ 0.625

export const ENM_SZ = 64;   // enemy sprite (square, centre = 32,32)

export const EGG_W = 24, EGG_H = 28;
export const LAR_W = 36, LAR_H = 30;
export const PUP_W = 30, PUP_H = 40;

// ─── Color palette ────────────────────────────────────────────────────────────

export const ANT_HEX: Record<AntType, number> = {
    worker: 0xd4a96a,
    soldier: 0xcc3333,
    scout: 0xe8d44d,
    queen: 0xcc44cc,
    nurse: 0x7ec8e3,
    princess: 0xcc44cc,
};
export const ENM_HEX = { beetle: 0x444455, spider: 0x882222 } as const;

export function darken(c: number, f = 0.55): number {
    return (((c >> 16 & 0xff) * f | 0) << 16)
        | (((c >> 8 & 0xff) * f | 0) << 8)
        | ((c & 0xff) * f | 0);
}

// Pack r,g,b into little-endian ABGR Uint32 for BufferImageSource.
export function pack(r: number, g: number, b: number): number {
    return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
}
