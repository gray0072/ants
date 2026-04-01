import { AIParams, AntQuadParams, DEFAULT_PARAMS } from './ai-params';

// Box-Muller normal sample
function gauss(): number {
    const u = Math.max(1e-10, Math.random());
    const v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function perturbQuad(p: AntQuadParams, scale: number): AntQuadParams {
    return {
        a:   p.a   + gauss() * scale * 0.0005,
        b:   p.b   + gauss() * scale,
        c:   p.c   + gauss() * scale * 5,
        min: Math.max(0,         p.min + gauss() * scale * 0.5),
        max: Math.max(p.min + 1, p.max + gauss() * scale * 5),
    };
}

// Mutation scale per param type — tuned to param magnitude
const SCALES: Record<keyof AIParams, number> = {
    nurse:   0.3,
    scout:   0.1,
    soldier: 0.5,
    worker:  1.5,
    chamber: 0.02,
};

export function cloneParams(params: AIParams): AIParams {
    const cp = (p: AntQuadParams): AntQuadParams => ({ ...p });
    return {
        nurse:   cp(params.nurse),
        scout:   cp(params.scout),
        soldier: cp(params.soldier),
        worker:  cp(params.worker),
        chamber: cp(params.chamber),
    };
}

const ANT_KEYS   = ['nurse', 'scout', 'soldier', 'worker', 'chamber'] as const;
const QUAD_FIELDS = ['a', 'b', 'c', 'min', 'max'] as const;

// Field-level scale multipliers relative to the ant-key scale
const FIELD_SCALES: Record<typeof QUAD_FIELDS[number], number> = {
    a: 0.1, b: 1, c: 5, min: 5, max: 5,
};

export function mutateParams(params: AIParams, temperature = 1): AIParams {
    const result = cloneParams(params);
    const key   = ANT_KEYS[Math.floor(Math.random() * ANT_KEYS.length)];
    const field = QUAD_FIELDS[Math.floor(Math.random() * QUAD_FIELDS.length)];
    const scale = SCALES[key] * FIELD_SCALES[field] * temperature;
    const quad  = { ...result[key] };
    quad[field] = quad[field] + gauss() * scale;
    if (field === 'min') quad.min = Math.max(0, quad.min);
    if (field === 'max') quad.max = Math.max(quad.min + 1, quad.max);
    result[key] = quad;
    return result;
}

// Decrease temperature over iterations: starts at 1, approaches 0.1
export function getTemperature(iterations: number): number {
    return Math.max(0.1, 1 / (1 + iterations * 0.05));
}

const STORAGE_KEY = 'ant_learn_best_params';

export function loadBestParams(): AIParams | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const p = JSON.parse(raw) as AIParams;
        // Basic shape check
        const keys: (keyof AIParams)[] = ['nurse', 'scout', 'soldier', 'worker', 'chamber'];
        if (!keys.every(k => p[k] && typeof p[k].b === 'number')) return null;
        return p;
    } catch {
        return null;
    }
}

export function saveBestParams(params: AIParams): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
}

export function resetBestParams(): void {
    localStorage.removeItem(STORAGE_KEY);
}

export { DEFAULT_PARAMS };
