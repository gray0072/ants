import { AIParams, AntQuadParams, AIParamKey, DEFAULT_PARAMS } from './ai-params';
import { runSimulationGen, SimResult, MAX_SIM_TICKS } from './simulation';
import {
    mutateParams, cloneParams, getTemperature,
    loadBestParams, saveBestParams, resetBestParams,
} from './optimizer';
import { STATE } from '../state';

// ── constants ─────────────────────────────────────────────────────────────────

const TICKS_PER_FRAME  = 1500;
const RUNS_PER_CANDIDATE = 3;
const STORAGE_KEY_SCORE  = 'ant_learn_best_score';
const STORAGE_KEY_RESULT = 'ant_learn_best_result';

// ── param table layout ────────────────────────────────────────────────────────

type ParamField = keyof AntQuadParams;
const PARAM_FIELDS: ParamField[] = ['a', 'b', 'c', 'min', 'max'];
const ANT_KEYS: AIParamKey[]     = ['nurse', 'scout', 'soldier', 'worker', 'chamber'];

interface RowDesc { antKey: AIParamKey; field: ParamField; label: string }

const ROWS: RowDesc[] = ANT_KEYS.flatMap(antKey =>
    PARAM_FIELDS.map(field => ({ antKey, field, label: `${antKey}.${field}` }))
);

// ── optimizer state ───────────────────────────────────────────────────────────

let running        = false;
let iterations     = 0;
let bestScore      = -Infinity;
let bestResult: SimResult | null = null;
let bestParams: AIParams    = loadBestParams() ?? cloneParams(DEFAULT_PARAMS);
let currentParams: AIParams = cloneParams(bestParams);

// Restore best score/result from storage
const storedScore = localStorage.getItem(STORAGE_KEY_SCORE);
if (storedScore !== null) bestScore = parseFloat(storedScore);
try {
    const raw = localStorage.getItem(STORAGE_KEY_RESULT);
    if (raw) bestResult = JSON.parse(raw) as SimResult;
} catch { /* ignore */ }

// Active generator for the current episode
let gen: Generator<undefined, SimResult> | null = null;
let runIndex  = 0;           // 0..RUNS_PER_CANDIDATE-1
let runScores: number[] = []; // scores collected for current candidate
let worstResult: SimResult | null = null; // result that produced the min score
let rafId = 0;

// ── DOM refs ──────────────────────────────────────────────────────────────────

let statusEl: HTMLElement;
let iterEl: HTMLElement;
let lastScoreEl: HTMLElement;
let bestScoreEl: HTMLElement;
let bestResultEl: HTMLElement;
let valueCells: Map<string, { orig: HTMLElement; curr: HTMLElement; best: HTMLElement }>;

// ── formatting ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
    return isNaN(n) ? '—' : (Math.round(n * 10000) / 10000).toString();
}

// ── best-result display ───────────────────────────────────────────────────────

function renderBestResult(): void {
    if (!bestResult) {
        bestResultEl.innerHTML = '<span class="best-result-label">Best run:</span> —';
        return;
    }
    const r = bestResult;
    const tag = r.won ? '<span class="tag-won">WON</span> &nbsp;' : '';
    bestResultEl.innerHTML =
        `<span class="best-result-label">Best run:</span> `
        + tag
        + `flights <span>${r.completedFlights}</span>`
        + ` &nbsp; wave <span>${r.wave}</span>`
        + ` &nbsp; ticks <span>${r.ticks.toLocaleString()}</span>`;
}

// ── table update ─────────────────────────────────────────────────────────────

function updateTable(): void {
    for (const { antKey, field, label } of ROWS) {
        const cells = valueCells.get(label);
        if (!cells) continue;
        cells.orig.textContent = fmt(DEFAULT_PARAMS[antKey][field]);
        const currVal = currentParams[antKey][field];
        const bestVal = bestParams[antKey][field];
        cells.curr.textContent  = fmt(currVal);
        cells.curr.className    = currVal !== bestVal ? 'col-changed' : '';
        cells.best.textContent  = fmt(bestVal);
    }
}

// ── simulation loop ───────────────────────────────────────────────────────────

function step(): void {
    if (!running) return;

    if (!gen) gen = runSimulationGen(currentParams, MAX_SIM_TICKS);

    // Run a chunk of ticks
    let done = false;
    let result: SimResult | undefined;

    for (let i = 0; i < TICKS_PER_FRAME; i++) {
        const next = gen!.next();
        if (next.done) { result = next.value; done = true; break; }
    }

    // Update status bar every frame
    statusEl.textContent =
        `run ${runIndex + 1}/${RUNS_PER_CANDIDATE} · tick ${STATE.tick.toLocaleString()} · wave ${STATE.wave}`;

    if (done && result) {
        runScores.push(result.score);
        if (!worstResult || result.score < worstResult.score) worstResult = result;
        gen = null;
        runIndex++;

        if (runIndex < RUNS_PER_CANDIDATE) {
            // More runs needed for this candidate — start next immediately
            rafId = requestAnimationFrame(step);
            return;
        }

        // All runs done — evaluate candidate by worst score
        const candidateScore = Math.min(...runScores);
        lastScoreEl.textContent = `${candidateScore.toLocaleString()} (${runScores.map(s => s.toLocaleString()).join(', ')})`;

        if (candidateScore > bestScore) {
            bestScore  = candidateScore;
            bestResult = worstResult;
            bestParams = cloneParams(currentParams);
            saveBestParams(bestParams);
            localStorage.setItem(STORAGE_KEY_SCORE, String(bestScore));
            localStorage.setItem(STORAGE_KEY_RESULT, JSON.stringify(worstResult));
            bestScoreEl.textContent = bestScore.toLocaleString();
            renderBestResult();
        }

        // Prepare next candidate
        const temp = getTemperature(iterations);
        currentParams = mutateParams(bestParams, temp);
        iterations++;
        runIndex   = 0;
        runScores  = [];
        worstResult = null;
        iterEl.textContent = iterations.toLocaleString();

        updateTable();
    }

    rafId = requestAnimationFrame(step);
}

// ── start / stop ─────────────────────────────────────────────────────────────

function startLearning(): void {
    if (running) return;
    running = true;
    (document.getElementById('btn-start') as HTMLButtonElement).disabled = true;
    (document.getElementById('btn-stop')  as HTMLButtonElement).disabled = false;
    gen = null;
    runIndex  = 0;
    runScores = [];
    worstResult = null;
    rafId = requestAnimationFrame(step);
}

function stopLearning(): void {
    running = false;
    cancelAnimationFrame(rafId);
    (document.getElementById('btn-start') as HTMLButtonElement).disabled = false;
    (document.getElementById('btn-stop')  as HTMLButtonElement).disabled = true;
    statusEl.textContent = 'stopped';
}

function resetBest(): void {
    resetBestParams();
    localStorage.removeItem(STORAGE_KEY_SCORE);
    localStorage.removeItem(STORAGE_KEY_RESULT);
    bestScore  = -Infinity;
    bestResult = null;
    bestParams = cloneParams(DEFAULT_PARAMS);
    currentParams = cloneParams(DEFAULT_PARAMS);
    iterations  = 0;
    runIndex    = 0;
    runScores   = [];
    worstResult = null;
    iterEl.textContent = '0';
    bestScoreEl.textContent = '—';
    lastScoreEl.textContent = '—';
    renderBestResult();
    updateTable();
}

// ── init ──────────────────────────────────────────────────────────────────────

function buildTable(): void {
    valueCells = new Map();
    const tbody = document.getElementById('params-body')!;
    tbody.innerHTML = '';

    let lastAnt = '';
    for (const { antKey, field, label } of ROWS) {
        const tr = document.createElement('tr');
        if (antKey !== lastAnt) {
            tr.className = 'row-group-start';
            lastAnt = antKey;
        }

        const tdLabel = document.createElement('td');
        tdLabel.textContent = label;
        tdLabel.className = 'col-label';

        const tdOrig = document.createElement('td');
        const tdCurr = document.createElement('td');
        const tdBest = document.createElement('td');

        tr.append(tdLabel, tdOrig, tdCurr, tdBest);
        tbody.appendChild(tr);

        valueCells.set(label, { orig: tdOrig, curr: tdCurr, best: tdBest });
    }

    updateTable();
}

window.addEventListener('load', () => {
    statusEl    = document.getElementById('status')!;
    iterEl      = document.getElementById('iter-count')!;
    lastScoreEl = document.getElementById('last-score')!;
    bestScoreEl = document.getElementById('best-score')!;
    bestResultEl = document.getElementById('best-result')!;

    document.getElementById('btn-start')!.addEventListener('click', startLearning);
    document.getElementById('btn-stop')!.addEventListener('click', stopLearning);
    document.getElementById('btn-reset')!.addEventListener('click', resetBest);

    bestScoreEl.textContent = isFinite(bestScore) ? bestScore.toLocaleString() : '—';
    renderBestResult();

    buildTable();
});
