import { CONFIG } from '../config';
import { STATE } from '../state';
import { STATS } from '../stats';
import { AntModule } from '../ant';
import { EnemyModule, createEnemy } from '../enemy';
import { ColonyModule } from '../colony';
import { MapModule } from '../map';

export interface BenchOptions {
    workers: number;
    soldiers: number;
    scouts: number;
    nurses: number;
    princesses: number;
    enemies: number;
    allChambers: boolean;
    expandSurface: boolean;
    revealFog: boolean;
}

export function setup(opts: BenchOptions): void {
    STATE.reset();
    STATS.reset();
    MapModule.init();

    ColonyModule.init();

    if (opts.expandSurface) MapModule.expandSurfaceFull();
    if (opts.allChambers) ColonyModule.digAllChambers();

    if (opts.revealFog) STATE.fog.fill(1);
    STATE.survival = true;

    ColonyModule.setAntsCount('worker', opts.workers);
    ColonyModule.setAntsCount('soldier', opts.soldiers);
    ColonyModule.setAntsCount('scout', opts.scouts);
    ColonyModule.setAntsCount('nurse', opts.nurses);
    ColonyModule.setAntsCount('princess', opts.princesses);

    STATE.autoSpawn.worker = true;
    STATE.autoSpawn.soldier = true;
    STATE.autoSpawn.scout = true;
    STATE.autoSpawn.nurse = true;
    STATE.autoSpawn.princess = true;

    const cols = CONFIG.COLS, surfRows = STATE.surfaceRows;
    for (let i = 0; i < opts.enemies; i++) {
        const c = Math.floor(Math.random() * cols);
        const r = Math.floor(Math.random() * surfRows);
        STATE.enemies.push(createEnemy(i % 2 === 0 ? 'beetle' : 'spider', c, r));
    }

    STATE.nextEnemySpawn = Number.MAX_SAFE_INTEGER;
    STATE.running = true;

    STATE.canDigChamber = ColonyModule.canDigChamber();
    STATE.canSpawnNurse = ColonyModule.canSpawnNurse();
    STATE.canSpawnPrincess = ColonyModule.canSpawnPrincess();
}

export function keepAlive(): void {
    STATE.running = true;
    if (STATE.queen) STATE.queen.hp = CONFIG.QUEEN_HP;
}

// Synchronous update-only bench — returns formatted result string
export function runUpdateBench(opts: BenchOptions, ticks = 1000, warmup = 100): string {
    setup(opts);
    for (let i = 0; i < warmup; i++) { STATE.tick++; keepAlive(); AntModule.update(); EnemyModule.update(); }

    setup(opts);
    const times: number[] = [];
    for (let i = 0; i < ticks; i++) {
        STATE.tick++;
        keepAlive();
        const t0 = performance.now();
        AntModule.update();
        EnemyModule.update();
        times.push(performance.now() - t0);
    }

    const total = times.reduce((a, b) => a + b, 0);
    const avg = total / ticks;
    const sorted = [...times].sort((a, b) => a - b);
    const pct = (p: number) => sorted[Math.floor(ticks * p)].toFixed(3);
    const budget = 1000 / CONFIG.UPS;

    return [
        `${STATE.ants.length} ants (${opts.workers}W ${opts.soldiers}S ${opts.scouts}Sc 1Q)  ×  ${STATE.enemies.length} enemies`,
        `ticks: ${ticks}  (+${warmup} warmup)`,
        ``,
        `avg  ${avg.toFixed(3)} ms   →  ${(1000 / avg).toFixed(0)} ticks/s`,
        `min  ${Math.min(...times).toFixed(3)} ms`,
        `p50  ${pct(0.50)} ms`,
        `p95  ${pct(0.95)} ms`,
        `p99  ${pct(0.99)} ms`,
        `max  ${Math.max(...times).toFixed(3)} ms`,
        ``,
        `budget ${budget.toFixed(2)} ms/tick  ${avg <= budget ? '✓ within budget' : '✗ over budget'}`,
    ].join('\n');
}
