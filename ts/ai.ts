import { CONFIG } from './config';
import { STATE } from './state';
import { ColonyModule } from './colony';
import { MapModule } from './map';

export function aiDecideAndOrder(): void {
    const pending = (STATE.queen?.eggQueue ?? []).length;
    const pop = STATE.ants.length + pending;
    const cap = STATE.popCap();

    // Nurses: less than chambers
    const nurseTarget = Math.min(STATE.chambers - 1, 16);
    const nurseCount = STATE.ants.filter(a => a.type === 'nurse').length + pending;
    if (nurseCount < nurseTarget && STATE.food >= CONFIG.COST_NURSE && pop < cap) {
        ColonyModule.orderAnt('nurse');
        return;
    }

    // Scouts: less than (surfaceRows * 0.2 + 2)
    const scoutTarget = Math.floor(STATE.surfaceRows * 0.2 + 3);
    const scoutCount = STATE.ants.filter(a => a.type === 'scout').length + pending;
    if (scoutCount < scoutTarget && STATE.food >= CONFIG.COST_SCOUT && pop < cap) {
        ColonyModule.orderAnt('scout');
        return;
    }

    // Soldiers: less than (waveEnemyCount * 2)
    const soldierTarget = STATE.waveEnemyCount * 2;
    const soldierCount = STATE.ants.filter(a => a.type === 'soldier').length + pending;
    if (soldierCount < soldierTarget && STATE.food >= CONFIG.COST_SOLDIER && pop < cap) {
        ColonyModule.orderAnt('soldier');
        return;
    }

    // Workers: less than (surfaceRows * 11 - 30)
    const workerTarget = STATE.surfaceRows * 11 - 30;
    const workerCount = STATE.ants.filter(a => a.type === 'worker').length + pending;
    if (workerCount < workerTarget && STATE.food >= CONFIG.COST_WORKER && pop < cap) {
        ColonyModule.orderAnt('worker');
        return;
    }

    // Chambers: less than ceil((pop + 5) / 20) or surface maxed
    const chamberTarget = Math.ceil((pop + 5) / 20);
    if ((STATE.chambers < chamberTarget || STATE.surfaceRows >= CONFIG.SURFACE_ROWS_MAX)
        && STATE.canDigChamber && STATE.food >= STATE.chamberCost()) {
        ColonyModule.digChamber();
        return;
    }

    // Surface: less than max
    if (STATE.surfaceRows < CONFIG.SURFACE_ROWS_MAX && STATE.food >= STATE.expandCost()) {
        MapModule.expandSurface();
        return;
    }

    // Princesses: less than limit
    const princessCount = STATE.ants.filter(a => a.type === 'princess' && a.lifestage === null).length + pending;
    if (princessCount < CONFIG.PRINCESS_LIMIT && STATE.canSpawnPrincess && STATE.food >= CONFIG.COST_PRINCESS && pop < cap) {
        ColonyModule.orderAnt('princess');
        return;
    }

    // Flight: available and not started
    if (princessCount >= CONFIG.PRINCESS_LIMIT && !STATE.flightStarted) {
        ColonyModule.startFlight();
        return;
    }
}