import { CONFIG } from '../config';
import { STATE } from '../state';
import { STATS } from '../stats';
import { AntModule } from '../ant';
import { EnemyModule } from '../enemy';
import { ColonyModule } from '../colony';
import { MapModule } from '../map';
import { FogModule } from '../fog';
import { DIFFICULTY_PRESETS } from '../difficulty';
import { AIParams } from './ai-params';
import { aiDecideAndOrderWithParams } from '../ai';

export interface SimResult {
    ticks: number;
    won: boolean;
    wave: number;
    flightEscaped: number;
    completedFlights: number;
    score: number;
}

// ~60 minutes game-time at 60 UPS (survival runs indefinitely, so we cap it)
export const MAX_SIM_TICKS = 60 * 60 * 60;

export function scoreResult(r: Omit<SimResult, 'score'>): number {
    return r.completedFlights * 1_000 + r.wave;
}

function applyHard(): void {
    const p = DIFFICULTY_PRESETS.hard;
    CONFIG.START_FOOD = p.startFood;
    CONFIG.PRINCESS_LIMIT = p.princessLimit;
    CONFIG.ENEMY_WAVE_SCALE = p.enemyWaveScale;
}

function initSim(): void {
    applyHard();
    STATE.reset();
    STATS.reset();
    MapModule.init();

    const nc = STATE.nestCol, nr = STATE.nestRow, surf = STATE.surfaceRows;
    FogModule.revealArea(nc, nr, 5);
    for (let r = surf - 1; r <= nr; r++) FogModule.revealArea(nc, r, 2);
    FogModule.revealArea(nc, Math.floor(surf / 2), 8);

    ColonyModule.init();

    STATE.running  = true;
    STATE.survival = true;
    STATE.autoAI   = false;
    // disable round-robin spawning so our AI has full control
    STATE.autoSpawn = { worker: false, soldier: false, scout: false, nurse: false, princess: false };
    // let colony handle building and flight
    STATE.autoBuild  = { chamber: true, expand: true };
    STATE.autoAction = { flight: true };
}

// Generator — yields after each tick so the caller can chunk execution.
// Returns the final SimResult when the episode ends.
export function* runSimulationGen(params: AIParams, maxTicks = MAX_SIM_TICKS): Generator<undefined, SimResult> {
    initSim();

    while (STATE.running && !STATE.over && STATE.tick < maxTicks) {
        STATE.tick++;
        AntModule.update();
        EnemyModule.update();
        ColonyModule.update();
        if (STATE.tick % CONFIG.FOOD_REGEN_INTERVAL === 0) MapModule.regenerateFood();
        if (STATE.tick % CONFIG.FOG_SHRINK_INTERVAL === 0) FogModule.shrinkFog();

        // Call our AI when the queen's queue is empty (colony.update has already handled build/flight)
        if (STATE.running && STATE.queen && (STATE.queen.eggQueue?.length ?? 0) === 0) {
            aiDecideAndOrderWithParams(params);
        }

        yield;
    }

    const base = {
        ticks: STATE.tick,
        won: STATE.won,
        wave: STATE.wave,
        flightEscaped: STATE.flightEscaped,
        completedFlights: STATE.completedFlights,
    };
    return { ...base, score: scoreResult(base) };
}
