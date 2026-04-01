// 5 constants per ant type: quadratic target = clamp(a*x² + b*x + c, min, max)
export interface AntQuadParams {
    a: number;
    b: number;
    c: number;
    min: number;
    max: number;
}

export interface AIParams {
    nurse:   AntQuadParams; // x = chambers
    scout:   AntQuadParams; // x = surfaceRows
    soldier: AntQuadParams; // x = waveEnemyCount
    worker:  AntQuadParams; // x = surfaceRows
    chamber: AntQuadParams; // x = pop
}

export type AIParamKey = keyof AIParams;

export function evalQuad(p: AntQuadParams, x: number): number {
    const v = p.a * x * x + p.b * x + p.c;
    return Math.max(p.min, Math.min(p.max, v));
}

// Original constants from ai.ts expressed as quadratic params
export const DEFAULT_PARAMS: AIParams = {
    // Math.min(STATE.chambers - 1, 16)  →  b*x + c  clamped to [0, 16]
    nurse:   { a: 0, b: 1,    c: -1,   min: 0, max: 16  },
    // Math.floor(STATE.surfaceRows * 0.2 + 3)
    scout:   { a: 0, b: 0.2,  c: 3,    min: 0, max: 100 },
    // STATE.waveEnemyCount * 2
    soldier: { a: 0, b: 2,    c: 0,    min: 0, max: 200 },
    // STATE.surfaceRows * 11 - 30
    worker:  { a: 0, b: 11,   c: -30,  min: 0, max: 300 },
    // Math.ceil((pop + 5) / 20)  →  0.05*x + 0.25  clamped to [1, 100]
    chamber: { a: 0, b: 0.05, c: 0.25, min: 1, max: 100 },
};
