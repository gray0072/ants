import { batch } from 'solid-js';
import { createStore } from 'solid-js/store';
import { CONFIG } from '../config';
import { STATE, AntType } from '../state';
import { STATS } from '../stats';
import { t, getLang, setLang, type Lang } from '../i18n';
import { getDifficulty, setDifficulty, applyDifficulty, type Difficulty } from '../difficulty';

export type AutoSpawnType = Exclude<AntType, 'queen'>;
export type AutoSpawn = Record<AutoSpawnType, boolean>;
export type AutoBuildType = 'chamber' | 'expand';
export type AutoBuild = Record<AutoBuildType, boolean>;
export type AutoActionType = 'flight';
export type AutoAction = Record<AutoActionType, boolean>;

export interface GameOverStats {
    maxAnts: number;
    produced: number;
    food: number;
    kills: number;
    princesses: number;
    stars: number;
}

export interface UIStore {
    food: number;
    pop: number;
    cap: number;
    wave: number;
    waveEnemies: number;
    queenHpPct: number;
    eggQueue: AntType[];

    cntWorker: number;
    cntSoldier: number;
    cntScout: number;
    cntNurse: number;
    cntPrincess: number;

    btnDisabled: Record<string, boolean>;
    autoSpawn: AutoSpawn;
    autoBuild: AutoBuild;
    autoAction: AutoAction;

    chamberMaxed: boolean;
    expandMaxed: boolean;
    chamberCost: number;
    expandCost: number;
    surfaceRows: number;
    chambers: number;

    queenAlive: boolean;
    chambersReached: boolean;
    surfaceReached: boolean;
    princessesReached: boolean;
    princessCount: number;
    chambersGoal: number;
    surfaceGoal: number;
    princessesGoal: number;
    chambersProg: string;
    surfaceProg: string;
    princessesProg: string;

    flightStarted: boolean;
    flightEscaped: number;
    flightTotal: number;
    flightProg: string;
    completedFlights: number;

    showIntro: boolean;
    showGameOver: boolean;
    gameOverWon: boolean;
    gameOverFocus: number;
    gameOverTitle: string;
    gameOverMsg: string;
    gameOverStats: GameOverStats;

    speed: number;
    lang: Lang;
    difficulty: Difficulty;

    showBench: boolean;
    perfUpdate: number;
    perfRender: number;
}

export const [store, setStore] = createStore<UIStore>({
    food: 0, pop: 0, cap: 0, wave: 0, waveEnemies: 0,
    queenHpPct: 100, eggQueue: [],
    cntWorker: 0, cntSoldier: 0, cntScout: 0, cntNurse: 0, cntPrincess: 0,
    btnDisabled: {},
    autoSpawn: { worker: false, soldier: false, scout: false, nurse: false, princess: false },
    autoBuild: { chamber: false, expand: false },
    autoAction: { flight: false },
    chamberMaxed: false, expandMaxed: false, chamberCost: 0, expandCost: 0,
    surfaceRows: 0, chambers: 0,
    queenAlive: true, chambersReached: false, surfaceReached: false, princessesReached: false,
    princessCount: 0, chambersGoal: CONFIG.GOAL_CHAMBERS, surfaceGoal: CONFIG.SURFACE_ROWS_MAX,
    princessesGoal: CONFIG.PRINCESS_LIMIT,
    chambersProg: `${CONFIG.START_CHAMBERS}/${CONFIG.GOAL_CHAMBERS}`,
    surfaceProg: `${CONFIG.SURFACE_ROWS_START}/${CONFIG.SURFACE_ROWS_MAX}`,
    princessesProg: `0/${CONFIG.PRINCESS_LIMIT}`,
    flightStarted: false, flightEscaped: 0, flightTotal: 0, flightProg: '0/0', completedFlights: 0,
    showIntro: false, showGameOver: false, gameOverWon: false, gameOverFocus: 0,
    gameOverTitle: '', gameOverMsg: '',
    gameOverStats: { maxAnts: 0, produced: 0, food: 0, kills: 0, princesses: 0, stars: 0 },
    speed: 1, lang: getLang(), difficulty: getDifficulty(),
    showBench: false, perfUpdate: 0, perfRender: 0,
});

let _onIntroStart: (() => void) | null = null;
let _currentSpeed = 1;
let _prevSpeed = 1;
let _gameSetSpeed: ((mult: number) => void) | null = null;
let _introCancel: (() => void) | null = null;
export function registerIntroCancel(fn: () => void): void { _introCancel = fn; }

let _gameRestart: (() => void) | null = null;
let _gameSurvival: (() => void) | null = null;
let _gamePause: (() => void) | null = null;
let _gameResume: (() => void) | null = null;

export function registerGameCallbacks(cb: { setSpeed: (mult: number) => void; restart: () => void; startSurvival: () => void; pause: () => void; resume: () => void }): void {
    _gameSetSpeed = cb.setSpeed;
    _gameRestart = cb.restart;
    _gameSurvival = cb.startSurvival;
    _gamePause = cb.pause;
    _gameResume = cb.resume;
}

export function restartGame(): void {
    _gameRestart?.();
}

export function pauseGame(): void {
    _gamePause?.();
}

export function resumeGame(): void {
    setSpeed(1);
    _gameResume?.();
}

let _gameWasRunningBeforeBench = false;

export function gameWasRunningBeforeBench(): boolean {
    return _gameWasRunningBeforeBench;
}

export function toggleBench(): void {
    if (!store.showBench) {
        _introCancel?.();
        _gameWasRunningBeforeBench = STATE.running;
        pauseGame();
        setStore({ showIntro: false, showGameOver: false });
    }
    setStore('showBench', v => !v);
}

export function closeBench(): void {
    setStore('showBench', false);
}

let _emaUpdate = 0;
let _emaRender = 0;

export function setPerfMetrics(updateMs: number, renderMs: number): void {
    if (updateMs > 0) _emaUpdate = _emaUpdate * 0.9 + updateMs * 0.1;
    _emaRender = _emaRender * 0.9 + renderMs * 0.1;
    setStore({ perfUpdate: _emaUpdate, perfRender: _emaRender });
}

export function toggleAutoSpawn(type: AutoSpawnType): void {
    STATE.autoSpawn[type] = !STATE.autoSpawn[type];
    setStore('autoSpawn', type, STATE.autoSpawn[type]);
}

export function toggleAutoBuild(type: AutoBuildType): void {
    STATE.autoBuild[type] = !STATE.autoBuild[type];
    setStore('autoBuild', type, STATE.autoBuild[type]);
}

export function toggleAutoAction(type: AutoActionType): void {
    STATE.autoAction[type] = !STATE.autoAction[type];
    setStore('autoAction', type, STATE.autoAction[type]);
}

export function update(): void {
    const pending = STATE.queen?.eggQueue ?? [];
    const pop = STATE.ants.length + pending.length;
    const cap = STATE.popCap();
    const chamberMaxed = !STATE.canDigChamber;
    const expandMaxed = STATE.surfaceRows >= CONFIG.SURFACE_ROWS_MAX;
    const chamberCost = STATE.chamberCost();
    const expandCost = STATE.expandCost();

    const princessCount = STATE.ants.filter(a => a.type === 'princess' && a.lifestage === null).length;
    const queenAlive = STATE.queen !== null && STATE.queen.hp > 0;
    const chambersGoal = CONFIG.GOAL_CHAMBERS;
    const surfaceGoal = CONFIG.SURFACE_ROWS_MAX;
    const princessesGoal = CONFIG.PRINCESS_LIMIT;

    const cnt = (type: AntType): number =>
        STATE.ants.filter(a => a.type === type).length + pending.filter(o => o === type).length;

    batch(() => {
        setStore({
            food: Math.floor(STATE.food),
            pop, cap,
            wave: STATE.wave,
            waveEnemies: STATE.waveEnemyCount,
            queenHpPct: Math.max(0, ((STATE.queen?.hp || 0) / CONFIG.QUEEN_HP) * 100),
            eggQueue: [...pending],
            cntWorker: cnt('worker'),
            cntSoldier: cnt('soldier'),
            cntScout: cnt('scout'),
            cntNurse: cnt('nurse'),
            cntPrincess: cnt('princess'),
            btnDisabled: {
                worker: STATE.food < CONFIG.COST_WORKER || pop >= cap,
                soldier: STATE.food < CONFIG.COST_SOLDIER || pop >= cap,
                scout: STATE.food < CONFIG.COST_SCOUT || pop >= cap,
                nurse: STATE.food < CONFIG.COST_NURSE || pop >= cap || !STATE.canSpawnNurse,
                princess: STATE.food < CONFIG.COST_PRINCESS || pop >= cap || !STATE.canSpawnPrincess,
                chamber: chamberMaxed || STATE.food < chamberCost,
                expand: expandMaxed || STATE.food < expandCost,
                flight: princessCount < CONFIG.PRINCESS_LIMIT,
            },
            chamberMaxed, expandMaxed, chamberCost, expandCost,
            surfaceRows: STATE.surfaceRows,
            chambers: STATE.chambers,
            queenAlive,
            chambersReached: STATE.chambers >= chambersGoal,
            surfaceReached: STATE.surfaceRows >= surfaceGoal,
            princessesReached: princessCount >= princessesGoal,
            princessCount,
            chambersProg: `${Math.min(STATE.chambers, chambersGoal)}/${chambersGoal}`,
            surfaceProg: `${Math.min(STATE.surfaceRows, surfaceGoal)}/${surfaceGoal}`,
            princessesProg: `${Math.min(princessCount, princessesGoal)}/${princessesGoal}`,
            flightStarted: STATE.flightStarted,
            flightEscaped: STATE.flightEscaped,
            flightTotal: STATE.flightTotal,
            flightProg: `${STATE.flightEscaped}/${STATE.flightTotal}`,
            completedFlights: STATE.completedFlights,
        });
    });

    if (STATE.over && !store.showGameOver) showGameOverModal(STATE.won);
}

export function reset(): void {
    batch(() => {
        setStore('autoSpawn', { worker: false, soldier: false, scout: false, nurse: false, princess: false });
        setStore('autoBuild', { chamber: false, expand: false });
        setStore('autoAction', { flight: false });
        setStore('speed', 1);
        setStore('queenHpPct', 200);
    });
}

export function setGameActive(): void {
    setSpeed(1);
}

export function showGameOverModal(won: boolean): void {
    batch(() => {
        setStore({
            showGameOver: true,
            gameOverWon: won,
            gameOverFocus: 0,
            gameOverTitle: won ? t('modal_victory_title') : t('modal_defeat_title'),
            gameOverMsg: won
                ? t('modal_victory_msg').replace('{wave}', STATE.wave.toString())
                : t('modal_defeat_msg'),
            gameOverStats: {
                maxAnts: STATS.maxAnts,
                produced: STATS.totalAntsProduced,
                food: Math.floor(STATS.totalFoodCollected),
                kills: STATS.totalEnemiesKilled,
                princesses: STATS.totalPrincessesFled,
                stars: STATE.completedFlights,
            },
        });
    });
}

export function hideGameOverModal(): void {
    setStore('showGameOver', false);
}

export function showIntroModal(onStart: () => void): void {
    _onIntroStart = onStart;
    setStore({
        showIntro: true,
        princessesGoal: CONFIG.PRINCESS_LIMIT,
        lang: getLang(),
    });
    changeDifficulty(getDifficulty())
}

export function hideIntroModal(): void {
    setStore('showIntro', false);
    _onIntroStart = null;
}

export function triggerIntroStart(): void {
    const fn = _onIntroStart;
    hideIntroModal();
    if (fn) fn();
}

export function triggerSurvival(): void {
    _gameSurvival?.();
}

export function setSpeed(mult: number): void {
    if (mult !== 0) _prevSpeed = mult;
    _currentSpeed = mult;
    _gameSetSpeed?.(mult);
    setStore('speed', mult);
}

export function togglePause(): void {
    setSpeed(_currentSpeed === 0 ? _prevSpeed : 0);
}

export function toggleLang(): void {
    const next: Lang = getLang() === 'en' ? 'ru' : 'en';
    setLang(next);
    document.title = t('doc_title');
    setStore('lang', next);
}

export function changeDifficulty(d: Difficulty): void {
    setDifficulty(d);
    applyDifficulty();
    setStore({
        difficulty: d,
        princessesGoal: CONFIG.PRINCESS_LIMIT,
        princessesProg: `$0/${CONFIG.PRINCESS_LIMIT}`,
        food: CONFIG.START_FOOD,
    });
}
