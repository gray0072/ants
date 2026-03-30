import { Show, For } from 'solid-js';
import { AutoSpawnType, store } from './store';
import { TRANSLATIONS, type TranslationKey } from '../i18n';
const t = (key: TranslationKey): string => TRANSLATIONS[store.lang][key] as string;
import { CONFIG } from '../config';
import { ColonyModule } from '../colony';
import { MapModule } from '../map';
import {
    setSpeed, togglePause, toggleAutoSpawn, toggleAutoBuild, toggleAutoAction,
    triggerIntroStart, triggerSurvival, changeDifficulty, restartGame, toggleBench,
} from './store';
import type { AntType } from '../state';
import BenchPanel from './BenchPanel';

// ── Spawn buttons data ──────────────────────────────────────────────

const EGG_COLORS: Record<string, string> = {
    worker: '#d4a96a', soldier: '#cc3333', scout: '#e8d44d', nurse: '#7ec8e3', princess: '#cc44cc',
};
const EGG_LABELS: Record<string, string> = {
    worker: 'W', soldier: 'S', scout: 'E', nurse: 'N', princess: 'Q',
};
const MAX_DOTS = 14;

const SPAWN_TYPES: { type: AntType; dot: string; hotkey: string; key: string; cost: number }[] = [
    { type: 'worker', dot: '#d4a96a', hotkey: 'W', key: 'btn_worker', cost: CONFIG.COST_WORKER },
    { type: 'soldier', dot: '#cc3333', hotkey: 'S', key: 'btn_soldier', cost: CONFIG.COST_SOLDIER },
    { type: 'scout', dot: '#e8d44d', hotkey: 'E', key: 'btn_scout', cost: CONFIG.COST_SCOUT },
    { type: 'nurse', dot: '#7ec8e3', hotkey: 'D', key: 'btn_nurse', cost: CONFIG.COST_NURSE },
    { type: 'princess', dot: '#cc44cc', hotkey: 'Q', key: 'btn_princess', cost: CONFIG.COST_PRINCESS },
];

const DIFFICULTIES: { key: 'easy' | 'medium' | 'hard'; icon: string; hotkey: string }[] = [
    { key: 'easy', icon: '🌱', hotkey: '1' },
    { key: 'medium', icon: '⚔️', hotkey: '2' },
    { key: 'hard', icon: '💀', hotkey: '3' },
];

// ── Handlers ────────────────────────────────────────────────────────

function handleSpawnClick(type: AntType, e: MouseEvent): void {
    if (e.shiftKey) return;
    if ((e.currentTarget as HTMLButtonElement).classList.contains('btn-disabled')) return;
    ColonyModule.orderAnt(type);
}

function handleSpawnMouseDown(type: AutoSpawnType, e: MouseEvent): void {
    if (e.shiftKey && e.button === 0) { e.preventDefault(); toggleAutoSpawn(type); }
}

// ── Components ──────────────────────────────────────────────────────

function Header() {
    return (
        <header id="site-header">
            <h1>{t('title')}</h1>
            <span id="difficulty-badge">{DIFFICULTIES.find(d => d.key === store.difficulty)?.icon} {t(`diff_${store.difficulty}` as any)}</span>
            <button id="lang-btn" title="Language">EN</button>
            <a id="github-link" href="https://github.com/gray0072/ants" target="_blank" rel="noopener noreferrer" title="View on GitHub">
                <svg viewBox="0 0 16 16" width="22" height="22" aria-hidden="true" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
          0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
          -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
          .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
          -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27
          .68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12
          .51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48
          0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                </svg>
            </a>
        </header>
    )
}


function IntroModal() {
    return (
        <Show when={store.showIntro}>
            <div id="intro-modal">
                <div id="intro-modal-box">
                    <div id="intro-modal-title">{t('title')}</div>
                    <ul id="intro-modal-goals">
                        <li innerHTML={t('intro_goal1')} />
                        <li innerHTML={t('intro_goal2').replace('{n}', String(store.princessesGoal))} />
                        <li innerHTML={t('intro_goal3')} />
                    </ul>
                    <div id="difficulty-selector">
                        {DIFFICULTIES.map(d => (
                            <button
                                classList={{ 'diff-btn': true, 'active': store.difficulty === d.key }}
                                onClick={() => changeDifficulty(d.key)}
                            >
                                <span class="hotkey diff-hotkey">{d.hotkey}</span>
                                <span class="diff-icon">{d.icon}</span>
                                <span class="diff-name">{t(`diff_${d.key}` as any)}</span>
                            </button>
                        ))}
                    </div>
                    <div id="difficulty-desc">{t(`diff_desc_${store.difficulty}` as any)}</div>
                    <div id="intro-modal-hint" innerHTML={t('intro_hint')} />
                    <div id="intro-modal-hint-shift">{t('intro_hint_shift')}</div>
                    <button id="intro-modal-ok" onClick={() => triggerIntroStart()}>
                        {t('intro_start')}
                    </button>
                    <div id="intro-modal-skip">{t('intro_skip')}</div>
                </div>
            </div>
        </Show>
    );
}

function GameOverModal() {
    return (
        <Show when={store.showGameOver}>
            <div id="modal" classList={{ won: store.gameOverWon }}>
                <div id="modal-title">{store.gameOverTitle}</div>
                <div id="modal-msg">{store.gameOverMsg}</div>
                <div id="modal-stats">
                    <div class="stat-row"><span class="stat-label">{t('stats_max_ants')}</span><span class="stat-val">{store.gameOverStats.maxAnts}</span></div>
                    <div class="stat-row"><span class="stat-label">{t('stats_produced')}</span><span class="stat-val">{store.gameOverStats.produced}</span></div>
                    <div class="stat-row"><span class="stat-label">{t('stats_food')}</span><span class="stat-val">{store.gameOverStats.food}</span></div>
                    <div class="stat-row"><span class="stat-label">{t('stats_kills')}</span><span class="stat-val">{store.gameOverStats.kills}</span></div>
                    <div class="stat-row"><span class="stat-label">{t('stats_princesses')}</span><span class="stat-val">{store.gameOverStats.princesses}</span></div>
                    <div class="stat-row"><span class="stat-label">{t('stats_stars')}</span><span class="stat-val">{store.gameOverStats.stars}</span></div>
                </div>
                <Show when={store.gameOverWon}>
                    <button id="btn-survival" classList={{ focused: store.gameOverFocus === 0 }} onClick={() => triggerSurvival()}>{t('modal_survival')}</button>
                </Show>
                <button id="btn-restart" classList={{ focused: store.gameOverWon ? store.gameOverFocus === 1 : store.gameOverFocus === 0 }} onClick={() => restartGame()}>{t('modal_restart')}</button>
            </div>
        </Show>
    );
}

function EggQueue() {
    return (
        <Show when={store.eggQueue.length === 0} fallback={
            <>
                <For each={store.eggQueue.slice(0, MAX_DOTS)}>{(o) =>
                    <span class="eq-dot" style={{ background: EGG_COLORS[o] }} title={o}>{EGG_LABELS[o]}</span>
                }</For>
                <Show when={store.eggQueue.length > MAX_DOTS}>
                    <span class="eq-overflow">+{store.eggQueue.length - MAX_DOTS}</span>
                </Show>
            </>
        }>
            —
        </Show>
    );
}

function Hud() {
    return (
        <div id="hud">
            {/* Stats */}
            <div class="hud-row">
                <div class="hud-section">
                    <div class="hud-label">{t('hud_food')}</div>
                    <div class="hud-value">{store.food} 🍒</div>
                </div>
                <div class="hud-section">
                    <div class="hud-label">{t('hud_pop')}</div>
                    <div class="hud-value">{store.pop} / {store.cap}</div>
                </div>
            </div>

            <div class="hud-row">
                <div class="hud-section">
                    <div class="hud-label">{t('hud_wave')}</div>
                    <div class="hud-value">
                        {store.wave}{' '}
                        <span style={{ 'font-size': '0.7rem', color: '#8a7a5a' }}>
                            ({store.waveEnemies} {t('enemies')})
                        </span>
                    </div>
                </div>
                <div class="hud-section">
                    <div class="hud-label">
                        <span>{t('hud_queen_hp')}</span> {' '}
                        <span>{store.queenHpPct.toFixed(0)}%</span>
                    </div>
                    <div id="queen-hp-wrap">
                        <div id="ui-queen-bar" style={{ width: store.queenHpPct + '%' }} />
                    </div>
                </div>
            </div>

            {/* Egg Queue */}
            <div class="hud-section">
                <div class="hud-label">{t('hud_egg_queue')}</div>
                <div id="egg-queue"><EggQueue /></div>
            </div>

            {/* Spawn */}
            <div class="hud-section">
                <div class="hud-label">{t('hud_spawn')}</div>
                <div class="spawn-list">
                    <For each={SPAWN_TYPES}>{({ type, dot, hotkey, key, cost }) => {
                        const countKey = ('cnt' + type.charAt(0).toUpperCase() + type.slice(1)) as keyof typeof store;
                        return (
                            <button
                                classList={{
                                    'btn': true, 'spawn-btn': true,
                                    'btn-disabled': store.btnDisabled[type],
                                    'btn-auto': store.autoSpawn[type],
                                }}
                                onMouseDown={[handleSpawnMouseDown, type]}
                                onClick={[handleSpawnClick, type]}
                            >
                                <span class="spawn-left">
                                    <span class="spawn-dot" style={{ background: dot }} />
                                    <span class="hotkey">{hotkey}</span>
                                    <span class="spawn-name">{t(key as any)}</span>
                                </span>
                                <span class="spawn-count">{store[countKey] as number}</span>
                                <span class="spawn-right">
                                    <span class="spawn-auto">⟳</span>
                                    <span class="cost">🍒 {cost}</span>
                                </span>
                            </button>
                        );
                    }}</For>
                </div>
            </div>

            {/* Build */}
            <div class="hud-section">
                <div class="hud-label">{t('hud_build')}</div>
                <div class="btn-grid">
                    <div class="btn-cell">
                        <button
                            classList={{ 'btn': true, 'btn-auto': store.autoBuild.chamber }}
                            disabled={store.btnDisabled.chamber}
                            onMouseDown={(e) => { if (e.shiftKey && e.button === 0) { e.preventDefault(); toggleAutoBuild('chamber'); } }}
                            onClick={(e) => { if (!e.shiftKey) ColonyModule.digChamber(); }}
                        >
                            <span class="hotkey">R</span> {t('btn_chamber')}{' '}
                            <span class="cost">{store.chamberMaxed ? t('cost_max') : '🍒 ' + store.chamberCost}</span>{' '}
                            <span class="spawn-auto">⟳</span>
                        </button>
                        <div class="btn-sub">{t('chambers_label')} {store.chambers} / {CONFIG.GOAL_CHAMBERS}</div>
                    </div>
                    <div class="btn-cell">
                        <button
                            classList={{ 'btn': true, 'btn-auto': store.autoBuild.expand }}
                            disabled={store.btnDisabled.expand}
                            onMouseDown={(e) => { if (e.shiftKey && e.button === 0) { e.preventDefault(); toggleAutoBuild('expand'); } }}
                            onClick={(e) => { if (!e.shiftKey) MapModule.expandSurface(); }}
                        >
                            <span class="hotkey">F</span> {t('btn_expand')}{' '}
                            <span class="cost">{store.expandMaxed ? t('cost_max') : '🍒 ' + store.expandCost}</span>{' '}
                            <span class="spawn-auto">⟳</span>
                        </button>
                        <div class="btn-sub">{t('surface_label')} {store.surfaceRows} / {CONFIG.SURFACE_ROWS_MAX}</div>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div class="hud-section">
                <div class="hud-label">{t('hud_legend')}</div>
                <div class="legend">
                    <div class="legend-col">
                        <div class="legend-row"><div class="legend-dot" style={{ background: '#cc44cc' }} /><span>{t('leg_queen')}</span></div>
                        <div class="legend-row"><div class="legend-dot" style={{ background: '#64c850' }} /><span>{t('leg_food')}</span></div>
                    </div>
                    <div class="legend-col">
                        <div class="legend-row"><div class="legend-dot" style={{ background: '#444455' }} /><span>{t('leg_beetle')}</span></div>
                        <div class="legend-row"><div class="legend-dot" style={{ background: '#882222' }} /><span>{t('leg_spider')}</span></div>
                    </div>
                </div>
            </div>

            {/* Goals */}
            <div class="hud-section">
                <div class="hud-label">{t('hud_goals')}</div>
                <div class="goals-list">
                    <div class="goal-row">
                        <span classList={{ 'goal-check': true, 'goal-done': store.queenAlive }}>{store.queenAlive ? '☑' : '☐'}</span>
                        <span>{t('goal_queen')}</span>
                    </div>
                    <div class="goal-row">
                        <span classList={{ 'goal-check': true, 'goal-done': store.chambersReached }}>{store.chambersReached ? '☑' : '☐'}</span>
                        <span>{t('goal_chambers')}</span>
                        <span class="goal-progress">{store.chambersProg}</span>
                    </div>
                    <div class="goal-row">
                        <span classList={{ 'goal-check': true, 'goal-done': store.surfaceReached }}>{store.surfaceReached ? '☑' : '☐'}</span>
                        <span>{t('goal_surface')}</span>
                        <span class="goal-progress">{store.surfaceProg}</span>
                    </div>
                    <div class="goal-row">
                        <span classList={{ 'goal-check': true, 'goal-done': store.princessesReached }}>{store.princessesReached ? '☑' : '☐'}</span>
                        <span>{t('goal_princesses').replace('{n}', String(store.princessesGoal))}</span>
                        <span class="goal-progress">{store.princessesProg}</span>
                    </div>
                    <div class="goal-row goal-row-flight">
                        <span classList={{ 'goal-check': true, 'goal-done': store.flightStarted }}>{store.flightStarted ? '☑' : '☐'}</span>
                        <span>{t('goal_flight')}</span>
                        <button
                            classList={{ 'btn': true, 'btn-flight': true, 'btn-disabled': !store.princessesReached || store.flightStarted, 'btn-auto': store.autoAction.flight }}
                            onMouseDown={(e) => { if (e.shiftKey && e.button === 0) { e.preventDefault(); toggleAutoAction('flight'); } }}
                            onClick={(e) => { if (!e.shiftKey && !(e.currentTarget as HTMLButtonElement).classList.contains('btn-disabled')) ColonyModule.startFlight(); }}
                        >
                            <span class="hotkey">A</span> {t('btn_start_flight')} <span class="spawn-auto">⟳</span>
                        </button>
                        <Show when={store.flightStarted}>
                            <span class="goal-progress">{store.flightProg}</span>
                        </Show>
                    </div>
                    <Show when={store.completedFlights > 0}>
                        <div id="flight-stars">
                            {'★'.repeat(Math.min(Math.floor(store.completedFlights / 10), 20))}
                            {'★'.repeat(Math.min(store.completedFlights % 10, 9))}
                        </div>
                    </Show>
                </div>
            </div>

            {/* Speed */}
            <div class="hud-section">
                <div class="hud-label">{t('hud_speed')}</div>
                <div id="speed-btns">
                    <button classList={{ 'btn': true, 'speed-btn': true, 'active': store.speed === 0 }} onClick={() => togglePause()}>
                        <span class="hotkey">Spc</span> ⏸
                    </button>
                    <button classList={{ 'btn': true, 'speed-btn': true, 'active': store.speed === 1 }} onClick={() => setSpeed(1)}>
                        <span class="hotkey">1</span> 1×
                    </button>
                    <button classList={{ 'btn': true, 'speed-btn': true, 'active': store.speed === 2 }} onClick={() => setSpeed(2)}>
                        <span class="hotkey">2</span> 2×
                    </button>
                    <button classList={{ 'btn': true, 'speed-btn': true, 'active': store.speed === 4 }} onClick={() => setSpeed(4)}>
                        <span class="hotkey">3</span> 4×
                    </button>
                    <button classList={{ 'btn': true, 'speed-btn': true, 'active': store.speed === 8 }} onClick={() => setSpeed(8)}>
                        <span class="hotkey">4</span> 8×
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Root App ────────────────────────────────────────────────────────

export default function App() {
    return (
        <>
            <Show when={store.showBench} fallback={<Header />}>
                <BenchPanel />
            </Show>
            <div id="layout">
                <div id="canvas-wrapper">
                    <canvas id="game-canvas" />
                    <IntroModal />
                    <GameOverModal />
                </div>
                <div id="hud-col">
                    <Hud />
                    <Show when={!store.showBench}>
                        <div id="hud-perf">
                            <span class="perf-item">upd {store.perfUpdate.toFixed(1)} ms</span>
                            <span class="perf-item">rnd {store.perfRender.toFixed(1)} ms</span>
                            <span class="perf-item">~{(store.perfUpdate + store.perfRender) > 0.5 ? Math.round(1000 / (store.perfUpdate + store.perfRender)) : '—'} fps</span>
                            <button class="btn bench-open-btn" onClick={toggleBench}><span class="hotkey">B</span> Bench</button>
                        </div>
                    </Show>
                </div>
            </div>
        </>
    );
}
