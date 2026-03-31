import { CONFIG } from './config';
import { STATE } from './state';
import { AntModule } from './ant';
import { EnemyModule } from './enemy';
import { ColonyModule } from './colony';
import { MapModule } from './map';
import { FogModule } from './fog';
import { Renderer } from './render';
import { UIModule } from './ui/index';
import { registerIntroCancel } from './ui/store';
import { IntroModule } from './intro';
import { applyDifficulty } from './difficulty';
import { STATS } from './stats';
import { PERF } from './perf';

const GameMain = (() => {
    let lastTime = 0;
    let accumulator = 0;
    let speedMult = 1;
    const FIXED_STEP = 1000 / CONFIG.UPS;

    function loop(timestamp: number): void {
        if (!STATE.running) return;
        const delta = Math.min(timestamp - lastTime, 100);
        lastTime = timestamp;
        accumulator += delta * speedMult;
        if (accumulator > FIXED_STEP * 16) accumulator = FIXED_STEP * 16;

        const t0 = performance.now();
        while (accumulator >= FIXED_STEP) {
            STATE.tick++;
            AntModule.update();
            EnemyModule.update();
            ColonyModule.update();
            if (STATE.tick % CONFIG.FOOD_REGEN_INTERVAL === 0) MapModule.regenerateFood();
            if (STATE.tick % CONFIG.FOG_SHRINK_INTERVAL === 0) FogModule.shrinkFog();
            accumulator -= FIXED_STEP;
        }
        const updateMs = performance.now() - t0;

        const t1 = performance.now();
        Renderer.render();
        const renderMs = performance.now() - t1;

        UIModule.update();
        UIModule.setPerfMetrics(updateMs, renderMs);
        PERF.flush();

        if (STATE.over) return;
        if (STATE.running) requestAnimationFrame(loop);
    }

    function start(): void {
        STATE.running = true;
        lastTime = performance.now();
        accumulator = 0;
        requestAnimationFrame(loop);
    }

    function pause(): void {
        STATE.running = false;
    }

    function startGame(): void {
        const nc = STATE.nestCol, nr = STATE.nestRow, surf = STATE.surfaceRows;
        FogModule.revealArea(nc, nr, 5);
        for (let r = surf - 1; r <= nr; r++) FogModule.revealArea(nc, r, 2);
        FogModule.revealArea(nc, Math.floor(surf / 2), 8);

        ColonyModule.init();
        CONFIG.PERF_DEBUG && ColonyModule.initPerfDebug();
        CONFIG.FOOD_DEBUG && (STATE.food = 999_999);
        UIModule.setGameActive();
        start();
    }

    function restart(): void {
        pause();
        UIModule.hideGameOverModal();
        UIModule.reset();
        applyDifficulty();
        STATE.reset();
        STATS.reset();
        MapModule.init();

        // Reveal initial area around nest for intro visibility
        const nc = STATE.nestCol, nr = STATE.nestRow, surf = STATE.surfaceRows;
        FogModule.revealArea(nc, nr, 5);
        for (let r = surf - 1; r <= nr; r++) FogModule.revealArea(nc, r, 2);
        FogModule.revealArea(nc, Math.floor(surf / 2), 8);

        IntroModule.play(() => {
            UIModule.showIntroModal(startGame);
        }, () => Renderer.render());
    }

    function startSurvival(): void {
        STATE.survival = true;
        STATE.over = false;
        UIModule.hideGameOverModal();
        start();
    }

    async function init(): Promise<void> {
        UIModule.init({ setSpeed, restart, startSurvival, pause, resume: start });
        registerIntroCancel(() => IntroModule.cancel());
        const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
        if (!canvas) return;
        await Renderer.init(canvas);
        restart();
    }

    function setSpeed(mult: number): void { speedMult = mult; }
    function getSpeed(): number { return speedMult; }

    return { init, start, pause, restart, setSpeed, getSpeed };
})();

window.addEventListener('load', () => GameMain.init());