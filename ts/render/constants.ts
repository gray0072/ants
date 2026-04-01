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

// Food pellet sprite — baked at DRAW_SCALE, body centre at (FOOD_CX, FOOD_CY).
// FOOD_BASE_R is the body radius as a fraction of CELL (= max r at t=1).
export const FOOD_SZ = 32;
export const FOOD_CX = 14;
export const FOOD_CY = 15;
export const FOOD_BASE_R = 0.44;

// Nest marker ring — baked at DRAW_SCALE (square, centre = SZ/2).
export const NEST_SZ = 128;

// Carried food pellet — baked at DRAW_SCALE (square, centre = SZ/2).
// CARRY_FOOD_BASE_R is the ant-body r fraction at queen scale (max).
export const CARRY_FOOD_SZ = 16;
export const CARRY_FOOD_BASE_R = 0.55;

// Carried egg (nurse) — baked at DRAW_SCALE, centre = (W/2, H/2).
export const CARRY_EGG_W = 10;
export const CARRY_EGG_H = 12;

export const EGG_W = 24, EGG_H = 28;
export const LAR_W = 36, LAR_H = 30;
export const PUP_W = 30, PUP_H = 40;

// Princess flight wings — baked at DRAW_SCALE, origin = ant body centre.
// r = CELL * 0.55 * 1.25 * DRAW_SCALE = 16.5; x extents ±r*3.2 = ±52.8; y: -17 to +7.4
export const WING_FRAMES = 8;
export const WING_W = 114;
export const WING_H = 34;
export const WING_CX = 57;   // x=0 in wing-space (ant body, horizontal centre)
export const WING_CY = 21;   // y=0 in wing-space (ant body, ~62% down from top)

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
