// Simple self-contained spec for learn module logic.
// Call runSpecs() from the browser console or import in learn.html.

import { evalQuad, DEFAULT_PARAMS, AIParams } from './ai-params';
import { mutateParams, cloneParams } from './optimizer';
import { scoreResult } from './simulation';

type Assertion = { label: string; pass: boolean; detail?: string };

function assert(label: string, condition: boolean, detail?: string): Assertion {
    return { label, pass: condition, detail };
}

function near(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

export function runSpecs(): void {
    const results: Assertion[] = [];

    // ── evalQuad ────────────────────────────────────────────────────────────

    results.push(assert(
        'evalQuad: zero quadratic term gives linear',
        near(evalQuad({ a: 0, b: 2, c: 3, min: 0, max: 100 }, 5), 13),
    ));

    results.push(assert(
        'evalQuad: quadratic term works',
        near(evalQuad({ a: 1, b: 0, c: 0, min: 0, max: 100 }, 4), 16),
    ));

    results.push(assert(
        'evalQuad: clamps to min',
        near(evalQuad({ a: 0, b: 1, c: -1, min: 0, max: 16 }, 0), 0),
    ));

    results.push(assert(
        'evalQuad: clamps to max',
        near(evalQuad({ a: 0, b: 1, c: -1, min: 0, max: 16 }, 100), 16),
    ));

    // ── DEFAULT_PARAMS match original ai.ts formulas ──────────────────────

    // nurse: min(chambers - 1, 16)
    for (const chambers of [1, 5, 10, 17, 20]) {
        const expected = Math.min(chambers - 1, 16);
        const got      = Math.floor(evalQuad(DEFAULT_PARAMS.nurse, chambers));
        results.push(assert(
            `nurse target at chambers=${chambers}: expected ${expected}`,
            got === expected,
            `got ${got}`,
        ));
    }

    // scout: floor(surfaceRows * 0.2 + 3)
    for (const sr of [3, 10, 20, 30]) {
        const expected = Math.floor(sr * 0.2 + 3);
        const got      = Math.floor(evalQuad(DEFAULT_PARAMS.scout, sr));
        results.push(assert(
            `scout target at surfaceRows=${sr}: expected ${expected}`,
            got === expected,
            `got ${got}`,
        ));
    }

    // soldier: waveEnemyCount * 2
    for (const w of [0, 5, 20]) {
        const expected = w * 2;
        const got      = Math.floor(evalQuad(DEFAULT_PARAMS.soldier, w));
        results.push(assert(
            `soldier target at wave=${w}: expected ${expected}`,
            got === expected,
            `got ${got}`,
        ));
    }

    // worker: surfaceRows * 11 - 30 (clamped to >= 0)
    for (const sr of [3, 10, 30]) {
        const expected = Math.max(0, sr * 11 - 30);
        const got      = Math.floor(evalQuad(DEFAULT_PARAMS.worker, sr));
        results.push(assert(
            `worker target at surfaceRows=${sr}: expected ${expected}`,
            got === expected,
            `got ${got}`,
        ));
    }

    // ── scoreResult: flights * 1000 + wave ───────────────────────────────

    const base = { ticks: 50000, won: false, wave: 0, flightEscaped: 0, completedFlights: 0 };

    results.push(assert(
        'scoreResult: 0 flights, wave 0 → 0',
        scoreResult({ ...base, completedFlights: 0, wave: 0 }) === 0,
    ));

    results.push(assert(
        'scoreResult: 3 flights, wave 42 → 3042',
        scoreResult({ ...base, completedFlights: 3, wave: 42 }) === 3042,
    ));

    results.push(assert(
        'scoreResult: ticks and won do not affect score',
        scoreResult({ ...base, ticks: 1, won: true, completedFlights: 1, wave: 5 }) ===
        scoreResult({ ...base, ticks: 99999, won: false, completedFlights: 1, wave: 5 }),
    ));

    // ── cloneParams is a deep copy ────────────────────────────────────────

    const original: AIParams = cloneParams(DEFAULT_PARAMS);
    const cloned = cloneParams(original);
    cloned.nurse.b = 999;
    results.push(assert(
        'cloneParams: mutating clone does not affect original',
        original.nurse.b !== 999,
    ));

    // ── mutateParams preserves invariants ────────────────────────────────

    const mutated = mutateParams(DEFAULT_PARAMS, 1);
    const keys: (keyof AIParams)[] = ['nurse', 'scout', 'soldier', 'worker', 'chamber'];
    for (const k of keys) {
        results.push(assert(
            `mutateParams: ${k}.max >= ${k}.min + 1`,
            mutated[k].max >= mutated[k].min + 1,
            `min=${mutated[k].min} max=${mutated[k].max}`,
        ));
        results.push(assert(
            `mutateParams: ${k}.min >= 0`,
            mutated[k].min >= 0,
            `min=${mutated[k].min}`,
        ));
    }

    // ── report ────────────────────────────────────────────────────────────

    const failed = results.filter(r => !r.pass);
    const passed = results.length - failed.length;

    console.group(`learn.spec — ${passed}/${results.length} passed`);
    for (const r of results) {
        const icon = r.pass ? '✓' : '✗';
        const msg  = r.detail ? `${r.label} (${r.detail})` : r.label;
        if (r.pass) console.log(`${icon} ${msg}`);
        else        console.error(`${icon} ${msg}`);
    }
    console.groupEnd();

    if (failed.length > 0) console.error(`${failed.length} test(s) FAILED`);
    else                   console.info('All tests passed.');
}
