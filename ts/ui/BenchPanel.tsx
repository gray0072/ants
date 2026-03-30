import { createSignal, onCleanup } from 'solid-js';
import { closeBench, pauseGame, restartGame, resumeGame, gameWasRunningBeforeBench } from './store';
import { runUpdateBench, BenchOptions } from '../bench/bench';
import { startRenderBench } from '../bench/bench-render';
import { CONFIG } from '../config';

const NURSE_MAX = CONFIG.CHAMBER_FLOORS * CONFIG.CHAMBERS_PER_FLOOR;
const PRINCESS_MAX = CONFIG.PRINCESS_LIMIT;

function ls(key: string, def: string): string {
    return localStorage.getItem(key) ?? def;
}

export default function BenchPanel() {
    function persist<T>(key: string, init: T, toStr: (v: T) => string): [() => T, (v: T) => void] {
        const [get, set] = createSignal<T>(init);
        return [get, (v: T) => { set(() => v); localStorage.setItem(key, toStr(v)); }];
    }
    function persistNum(key: string, def: string): [() => number, (v: number) => void] {
        return persist(key, +ls(key, def), String);
    }
    function persistBool(key: string, def: string): [() => boolean, (v: boolean) => void] {
        return persist(key, ls(key, def) === '1', v => v ? '1' : '0');
    }

    const [workers,      setWorkers]      = persistNum ('bench_workers',       '300');
    const [soldiers,     setSoldiers]     = persistNum ('bench_soldiers',      '150');
    const [scouts,       setScouts]       = persistNum ('bench_scouts',        '20');
    const [nurses,       setNurses]       = persistNum ('bench_nurses',        '0');
    const [princesses,   setPrincesses]   = persistNum ('bench_princesses',    String(PRINCESS_MAX));
    const [enemies,      setEnemies]      = persistNum ('bench_enemies',       '300');
    const [allChambers,  setAllChambers]  = persistBool('bench_all_chambers',  '1');
    const [expandSurface,setExpandSurface]= persistBool('bench_expand_surface','1');
    const [cbUpdate,     setCbUpdate]     = persistBool('bench_cb_update',     '1');
    const [cbRender,     setCbRender]     = persistBool('bench_cb_render',     '1');
    const [revealFog,    setRevealFog]    = persistBool('bench_reveal_fog',    '1');

    const [btnState, setBtnState] = createSignal<'idle' | 'loading' | 'running'>('idle');
    let benchUsed = false;
    let stopFn: (() => void) | null = null;
    let perfEl!: HTMLPreElement;

    const onKey = (ev: KeyboardEvent) => {
        if (ev.code === 'KeyV') handleStart();
        if (ev.code === 'KeyB') handleBack();
    };
    document.addEventListener('keydown', onKey);
    onCleanup(() => { stopFn?.(); stopFn = null; document.removeEventListener('keydown', onKey); });

    async function handleStart() {
        if (btnState() === 'running') {
            stopFn?.(); stopFn = null;
            setBtnState('idle');
            return;
        }
        if (!cbUpdate() && !cbRender()) {
            perfEl.textContent = 'Select at least one option.';
            return;
        }
        pauseGame();
        benchUsed = true;

        const opts: BenchOptions = {
            workers: workers(), soldiers: soldiers(), scouts: scouts(),
            nurses: nurses(), princesses: princesses(), enemies: enemies(),
            allChambers: allChambers(), expandSurface: expandSurface(),
            revealFog: revealFog(),
        };

        if (!cbRender()) {
            setBtnState('loading');
            perfEl.textContent = 'Running…';
            await new Promise(r => setTimeout(r, 50));
            perfEl.textContent = runUpdateBench(opts);
            setBtnState('idle');
            return;
        }

        const mode = cbUpdate() ? 'both' : 'render';
        stopFn = startRenderBench(perfEl, opts, mode);
        setBtnState('running');
    }

    function handleBack() {
        stopFn?.(); stopFn = null;
        closeBench();
        if (benchUsed || !gameWasRunningBeforeBench()) restartGame(); else resumeGame();
    }

    function spin(get: () => number, set: (v: number) => void, min: number, max: number, delta: number) {
        set(Math.min(max, Math.max(min, get() + delta)));
    }

    function SpinInput(props: { get: () => number; set: (v: number) => void; min: number; max: number }) {
        return (
            <div class="bench-spin">
                <button class="bench-spin-btn" onClick={() => props.set(props.min)}>0</button>
                <button class="bench-spin-btn" onClick={() => spin(props.get, props.set, props.min, props.max, -10)}>−</button>
                <input type="number" min={props.min} max={props.max} value={props.get()} onInput={e => props.set(+e.currentTarget.value)} />
                <button class="bench-spin-btn" onClick={() => spin(props.get, props.set, props.min, props.max, +10)}>+</button>
                <button class="bench-spin-btn" onClick={() => props.set(props.max)}>max</button>
            </div>
        );
    }

    return (
        <div id="bench-bar">
            <div class="bench-group">
                <div class="bench-group-title">Scenario</div>
                <div class="bench-scenario-cols">
                    <div class="bench-col">
                        <div class="bench-row"><label>Workers</label><SpinInput get={workers} set={setWorkers} min={0} max={500} /></div>
                        <div class="bench-row"><label>Soldiers</label><SpinInput get={soldiers} set={setSoldiers} min={0} max={500} /></div>
                        <div class="bench-row"><label>Scouts</label><SpinInput get={scouts} set={setScouts} min={0} max={500} /></div>
                        <div class="bench-row"><label>Nurses</label><SpinInput get={nurses} set={setNurses} min={0} max={NURSE_MAX} /></div>
                    </div>
                    <div class="bench-col">
                        <div class="bench-row"><label>Princesses</label><SpinInput get={princesses} set={setPrincesses} min={0} max={PRINCESS_MAX} /></div>
                        <div class="bench-row"><label>Enemies</label><SpinInput get={enemies} set={setEnemies} min={0} max={500} /></div>
                        <div class="bench-row"><input type="checkbox" id="cb-all-chambers"   checked={allChambers()}   onChange={e => setAllChambers(e.currentTarget.checked)}   /><label for="cb-all-chambers">All chambers</label></div>
                        <div class="bench-row"><input type="checkbox" id="cb-expand-surface" checked={expandSurface()} onChange={e => setExpandSurface(e.currentTarget.checked)} /><label for="cb-expand-surface">Full surface</label></div>
                    </div>
                </div>
            </div>
            <div class="bench-group">
                <div class="bench-group-title">Measure</div>
                <div class="bench-row"><input type="checkbox" id="cb-update"     checked={cbUpdate()}  onChange={e => setCbUpdate(e.currentTarget.checked)}  /><label for="cb-update">Update (logic)</label></div>
                <div class="bench-row"><input type="checkbox" id="cb-render"     checked={cbRender()}  onChange={e => setCbRender(e.currentTarget.checked)}  /><label for="cb-render">Render</label></div>
                <div class="bench-row"><input type="checkbox" id="cb-reveal-fog" checked={revealFog()} onChange={e => setRevealFog(e.currentTarget.checked)} /><label for="cb-reveal-fog">Reveal map</label></div>
            </div>
            <div class="bench-actions">
                <button
                    class="btn"
                    classList={{ 'bench-stop': btnState() === 'running' }}
                    disabled={btnState() === 'loading'}
                    onClick={handleStart}
                >
                    <span class="hotkey">V</span> {btnState() === 'running' ? '■ Stop' : btnState() === 'loading' ? 'Loading…' : '▶ Start'}
                </button>
                <button class="btn bench-back-btn" onClick={handleBack}><span class="hotkey">B</span> ← Game</button>
            </div>
            <pre id="bench-perf" ref={el => perfEl = el}>—</pre>
        </div>
    );
}
