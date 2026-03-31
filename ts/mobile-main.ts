import { CONFIG } from './config';
import { STATE } from './state';
import { AntModule } from './ant';
import { EnemyModule } from './enemy';
import { ColonyModule } from './colony';
import { MapModule } from './map';
import { FogModule } from './fog';
import { MobileRenderer } from './mobile/renderer';
import { initTouchHandler, type TouchCamera } from './mobile/touch';
import * as MobileUI from './mobile/ui';
import { IntroModule } from './intro';
import { applyDifficulty } from './difficulty';
import { STATS } from './stats';
import { PERF } from './perf';

const GameMobile = (() => {
    let lastTime = 0;
    let accumulator = 0;
    let speedMult = 1;
    const FIXED_STEP = 1000 / CONFIG.UPS;
    let cameraController: ReturnType<typeof initTouchHandler> | null = null;

    function loop(timestamp: number): void {
        if (!STATE.running) return;
        const delta = Math.min(timestamp - lastTime, 100);
        lastTime = timestamp;
        accumulator += delta * speedMult;
        if (accumulator > FIXED_STEP * 16) accumulator = FIXED_STEP * 16;

        while (accumulator >= FIXED_STEP) {
            STATE.tick++;
            AntModule.update();
            EnemyModule.update();
            ColonyModule.update();
            if (STATE.tick % CONFIG.FOOD_REGEN_INTERVAL === 0) MapModule.regenerateFood();
            if (STATE.tick % CONFIG.FOG_SHRINK_INTERVAL === 0) FogModule.shrinkFog();
            accumulator -= FIXED_STEP;
        }

        MobileRenderer.render();
        MobileUI.update();
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
        MobileUI.hideIntroModal();
        start();
    }

    function restart(): void {
        pause();
        MobileUI.hideGameOverModal();
        applyDifficulty();
        STATE.reset();
        STATS.reset();
        MapModule.init();

        // Center camera on nest
        const nestPx = STATE.nestCol * CONFIG.CELL + CONFIG.CELL / 2;
        const nestPy = STATE.nestRow * CONFIG.CELL + CONFIG.CELL / 2;
        cameraController?.centerOn(nestPx, nestPy);

        // Reveal initial area around nest for intro visibility
        const nc = STATE.nestCol, nr = STATE.nestRow, surf = STATE.surfaceRows;
        FogModule.revealArea(nc, nr, 5);
        for (let r = surf - 1; r <= nr; r++) FogModule.revealArea(nc, r, 2);
        FogModule.revealArea(nc, Math.floor(surf / 2), 8);

        IntroModule.play(() => {
            MobileUI.showIntroModal(startGame);
        }, () => MobileRenderer.render());
    }

    function startSurvival(): void {
        STATE.survival = true;
        STATE.over = false;
        MobileUI.hideGameOverModal();
        start();
    }

    function centerCamera(wx: number, wy: number): void {
        cameraController?.centerOn(wx, wy);
    }

    async function init(): Promise<void> {
        const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
        const canvasArea = document.getElementById('canvas-area') as HTMLElement | null;
        if (!canvas || !canvasArea) return;

        // Size canvas area to fill available space
        const statusBar = document.getElementById('status-bar');
        const speedBar = document.getElementById('speed-bar');
        const statusH = statusBar?.offsetHeight || 40;
        const speedH = speedBar?.offsetHeight || 40;
        canvasArea.style.height = (window.innerHeight - statusH - speedH) + 'px';

        await MobileRenderer.init(canvas, canvasArea.clientWidth, canvasArea.clientHeight);

        // Init touch panning
        cameraController = initTouchHandler(canvasArea, { x: 0, y: 0 }, {
            onCameraMove: (cam) => MobileRenderer.setCamera(cam),
        });

        // Init mobile UI
        MobileUI.init({
            setSpeed: (mult: number) => { speedMult = mult; },
            restart,
            startSurvival,
            pause,
            resume: start,
            centerCamera,
        });

        // Handle resize / orientation change
        window.addEventListener('resize', () => {
            const sH = statusBar?.offsetHeight || 40;
            const spH = speedBar?.offsetHeight || 40;
            canvasArea.style.height = (window.innerHeight - sH - spH) + 'px';
            cameraController?.centerOn(
                cameraController.getCamera().x + canvasArea.clientWidth / 2,
                cameraController.getCamera().y + canvasArea.clientHeight / 2,
            );
        });

        restart();
    }

    return { init, start, pause, restart, setSpeed: (m: number) => { speedMult = m; } };
})();

window.addEventListener('load', () => GameMobile.init());
