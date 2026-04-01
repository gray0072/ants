import { CONFIG } from './config';
import { STATE } from './state';
import { ColonyModule } from './colony';
import { MapModule } from './map';
import { AIParams, evalQuad } from './learn/ai-params';

export interface AntLimits {
    nurse: number;
    scout: number;
    soldier: number;
    worker: number;
    chamber: number;
}

// Original hardcoded formulas.
export function calcLimitsSimple(): AntLimits {
    const pop = STATE.ants.length + (STATE.queen?.eggQueue ?? []).length;
    return {
        nurse: Math.min(STATE.chambers - 1, 16),
        scout: Math.floor(STATE.surfaceRows * 0.2 + 3),
        soldier: STATE.waveEnemyCount * 2,
        worker: Math.max(0, STATE.surfaceRows * 11 - 30),
        chamber: Math.ceil((pop + 5) / 20),
    };
}

// Quadratic formulas driven by params — load from localStorage via DEFAULT_PARAMS
// or pass learned constants directly.
export function calcLimitsLearned(params: AIParams): AntLimits {
    const pop = STATE.ants.length + (STATE.queen?.eggQueue ?? []).length;
    return {
        nurse: Math.floor(evalQuad(params.nurse, STATE.chambers)),
        scout: Math.floor(evalQuad(params.scout, STATE.surfaceRows)),
        soldier: Math.floor(evalQuad(params.soldier, STATE.waveEnemyCount)),
        worker: Math.floor(evalQuad(params.worker, STATE.surfaceRows)),
        chamber: Math.ceil(evalQuad(params.chamber, pop)),
    };
}

function decide(limits: AntLimits): void {
    const pending = (STATE.queen?.eggQueue ?? []).length;
    const pop = STATE.ants.length + pending;
    const cap = STATE.popCap();

    const nurseCount = STATE.ants.filter(a => a.type === 'nurse').length + pending;
    if (nurseCount < limits.nurse && STATE.food >= CONFIG.COST_NURSE && pop < cap) {
        ColonyModule.orderAnt('nurse');
        return;
    }

    const scoutCount = STATE.ants.filter(a => a.type === 'scout').length + pending;
    if (scoutCount < limits.scout && STATE.food >= CONFIG.COST_SCOUT && pop < cap) {
        ColonyModule.orderAnt('scout');
        return;
    }

    const soldierCount = STATE.ants.filter(a => a.type === 'soldier').length + pending;
    if (soldierCount < limits.soldier && STATE.food >= CONFIG.COST_SOLDIER && pop < cap) {
        ColonyModule.orderAnt('soldier');
        return;
    }

    const workerCount = STATE.ants.filter(a => a.type === 'worker').length + pending;
    if (workerCount < limits.worker && STATE.food >= CONFIG.COST_WORKER && pop < cap) {
        ColonyModule.orderAnt('worker');
        return;
    }

    if ((STATE.chambers < limits.chamber || STATE.surfaceRows >= CONFIG.SURFACE_ROWS_MAX)
        && STATE.canDigChamber && STATE.food >= STATE.chamberCost()) {
        ColonyModule.digChamber();
        return;
    }

    if (STATE.surfaceRows < CONFIG.SURFACE_ROWS_MAX && STATE.food >= STATE.expandCost()) {
        MapModule.expandSurface();
        return;
    }

    const princessCount = STATE.ants.filter(a => a.type === 'princess' && a.lifestage === null).length + pending;
    if (princessCount < CONFIG.PRINCESS_LIMIT && STATE.canSpawnPrincess && STATE.food >= CONFIG.COST_PRINCESS && pop < cap) {
        ColonyModule.orderAnt('princess');
        return;
    }

    if (princessCount >= CONFIG.PRINCESS_LIMIT && !STATE.flightStarted) {
        ColonyModule.startFlight();
        return;
    }
}

let _learnedParams: AIParams | null = null;
function getLearnedParams(): AIParams | null {
    if (_learnedParams) return _learnedParams;
    try {
        const raw = localStorage.getItem('ant_learn_best_params');
        if (raw) _learnedParams = JSON.parse(raw) as AIParams;
    } catch { /* ignore */ }
    return _learnedParams;
}

export function aiDecideAndOrder(): void {
    const p = getLearnedParams();
    if (p) {
        decide(calcLimitsLearned(p));
    }
    else {
        decide(calcLimitsSimple());
    }
}

export function aiDecideAndOrderWithParams(params: AIParams): void {
    decide(calcLimitsLearned(params));
}
