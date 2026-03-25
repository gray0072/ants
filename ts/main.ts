import { CONFIG } from './config';
import { STATE } from './state';
import { PheromoneModule } from './pheromone';
import { AntModule } from './ant';
import { EnemyModule } from './enemy';
import { ColonyModule } from './colony';
import { MapModule } from './map';
import { FogModule } from './fog';
import { Renderer } from './renderer_pixi';
import { UIModule } from './ui';
import { IntroModule } from './intro';

const GameMain = (() => {
    let lastTime = 0;
    let accumulator = 0;
    let rafId: number | null = null;
    let speedMult = 1;
    const FIXED_STEP = 1000 / CONFIG.UPS;

    function loop(timestamp: number): void {
        if (!STATE.running) return;
        const delta = Math.min(timestamp - lastTime, 100);
        lastTime = timestamp;
        accumulator += delta * speedMult;
        if (accumulator > FIXED_STEP * 16) accumulator = FIXED_STEP * 16;

        while (accumulator >= FIXED_STEP) {
            STATE.tick++;
            PheromoneModule.update();
            AntModule.update();
            EnemyModule.update();
            ColonyModule.update();
            UIModule.tickAutoSpawn();
            if (STATE.tick % CONFIG.FOOD_REGEN_INTERVAL === 0) MapModule.regenerateFood();
            if (STATE.tick % CONFIG.FOG_SHRINK_INTERVAL === 0) FogModule.shrinkFog();
            accumulator -= FIXED_STEP;
        }

        Renderer.render();
        UIModule.update();

        if (STATE.running) rafId = requestAnimationFrame(loop);
    }

    function start(): void {
        STATE.running = true;
        lastTime = performance.now();
        accumulator = 0;
        rafId = requestAnimationFrame(loop);
    }

    function stop(): void {
        STATE.running = false;
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    }

    function startGame(): void {
        // Re-apply initial fog (MapModule.init already called, just reset + reveal)
        if (STATE.fog) STATE.fog.fill(0);
        const nc = STATE.nestCol, nr = STATE.nestRow, surf = STATE.surfaceRows;
        FogModule.revealArea(nc, nr, 5);
        for (let r = surf - 1; r <= nr; r++) FogModule.revealArea(nc, r, 2);
        FogModule.revealArea(nc, Math.floor(surf / 2), 8);

        ColonyModule.init();
        CONFIG.PERF_DEBUG && ColonyModule.initPerfDebug();
        CONFIG.FOOD_DEBUG && (STATE.food = 999_999);
        start();
    }

    function restart(): void {
        stop();
        UIModule.hideModal();
        UIModule.reset();
        STATE.reset();
        MapModule.init();

        // Full fog for intro — whole map visible
        if (STATE.fog) STATE.fog.fill(1);

        IntroModule.play(() => {
            UIModule.showGoalsPopup(startGame);
        });
    }

    async function init(): Promise<void> {
        const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
        if (!canvas) return;
        await Renderer.init(canvas);
        UIModule.init();
        restart();
    }

    function setSpeed(mult: number): void { speedMult = mult; }
    function getSpeed(): number { return speedMult; }

    return { init, start, stop, restart, setSpeed, getSpeed };
})();

(window as any).GameMain = GameMain;
window.addEventListener('load', () => GameMain.init());