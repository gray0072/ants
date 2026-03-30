import { CONFIG } from '../config';
import { STATE } from '../state';
import { AntModule } from '../ant';
import { EnemyModule } from '../enemy';
import { ColonyModule } from '../colony';
import { MapModule } from '../map';
import { FogModule } from '../fog';
import { Renderer } from '../render';
import { BenchOptions, setup, keepAlive } from './bench';
import { store, setStore, update as syncStore } from '../ui/store';

export type BenchMode = 'render' | 'both';

const WINDOW = 60;

function avg(arr: number[]): number {
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function refreshPerfOut(el: HTMLElement, mode: BenchMode, updateMs: number[], renderMs: number[]): void {
    const u = avg(updateMs);
    const r = avg(renderMs);
    const total = u + r;
    const budget = 1000 / CONFIG.UPS;
    const lines: string[] = [];
    if (mode === 'both') lines.push(`update  ${u.toFixed(2)} ms`);
    lines.push(`render  ${r.toFixed(2)} ms`);
    if (mode === 'both') {
        lines.push(`total   ${total.toFixed(2)} ms`);
        lines.push(`fps  ~${total > 0 ? (1000 / total).toFixed(0) : '—'}   budget ${budget.toFixed(2)} ms`);
        lines.push(total <= budget ? '✓ within budget' : '✗ over budget');
    }
    el.textContent = lines.join('\n');
}

// Render bench — mirrors GameMain.loop() exactly, adding keepAlive + perf sampling.
// Does NOT call Renderer.init(): the game already owns the Pixi Application.
export function startRenderBench(
    perfOut: HTMLElement,
    opts: BenchOptions,
    mode: BenchMode,
): () => void {
    setup(opts);
    syncStore();
    setStore('autoSpawn', { ...STATE.autoSpawn });

    const FIXED_STEP = 1000 / CONFIG.UPS;
    let lastTime = performance.now();
    let accumulator = 0;

    const updateMs: number[] = [];
    const renderMs: number[] = [];
    let frameCount = 0;
    let raf = 0;

    function frame(timestamp: number): void {
        const delta = Math.min(timestamp - lastTime, 100);
        lastTime = timestamp;

        let totalUpdateMs = 0;
        if (mode === 'both') {
            accumulator += delta * store.speed;
            if (accumulator > FIXED_STEP * 16) accumulator = FIXED_STEP * 16;

            const t0 = performance.now();
            while (accumulator >= FIXED_STEP) {
                STATE.tick++;
                STATE.food = 999_999;
                keepAlive();
                AntModule.update();
                EnemyModule.update();
                ColonyModule.update();
                if (STATE.tick % CONFIG.FOOD_REGEN_INTERVAL === 0) MapModule.regenerateFood();
                if (STATE.tick % CONFIG.FOG_SHRINK_INTERVAL === 0) FogModule.shrinkFog();
                accumulator -= FIXED_STEP;
            }
            totalUpdateMs = performance.now() - t0;
            updateMs.push(totalUpdateMs);
            if (updateMs.length > WINDOW) updateMs.shift();
        }

        const t1 = performance.now();
        Renderer.render();
        renderMs.push(performance.now() - t1);
        if (renderMs.length > WINDOW) renderMs.shift();

        frameCount++;
        if (frameCount % 6 === 0) refreshPerfOut(perfOut, mode, updateMs, renderMs);

        raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); perfOut.textContent = '—'; };
}
