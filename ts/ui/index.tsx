import { render } from 'solid-js/web';
import App from './App';
import { ColonyModule } from '../colony';
import { MapModule } from '../map';
import {
    update, reset, setGameActive,
    hideGameOverModal, showIntroModal, hideIntroModal,
    setSpeed, togglePause, toggleAutoSpawn, toggleAutoBuild, toggleAutoAction,
    store, setStore, toggleLang,
    changeDifficulty, triggerIntroStart, triggerSurvival, restartGame,
    registerGameCallbacks, setPerfMetrics, toggleBench, toggleAI,
} from './store';
import { STATE } from '../state';
import { getLang } from '../i18n';
import type { Difficulty } from '../difficulty';

export const UIModule = {
    init(callbacks: { setSpeed: (mult: number) => void; restart: () => void; startSurvival: () => void; pause: () => void; resume: () => void }): void {
        registerGameCallbacks(callbacks);
        const root = document.getElementById('app');
        if (root) render(() => <App />, root);

        document.addEventListener('keydown', (ev) => {
            if (ev.code === 'KeyB' && !store.showBench) {
                toggleBench(); return;
            }
            if (ev.code === 'KeyI' && !store.showBench) {
                toggleAI(); return;
            }
            if (store.showIntro) {
                const diffs: Difficulty[] = ['easy', 'medium', 'hard'];
                const cur = diffs.indexOf(store.difficulty);
                switch (ev.code) {
                    case 'Digit1': changeDifficulty(diffs[0]); return;
                    case 'Digit2': changeDifficulty(diffs[1]); return;
                    case 'Digit3': changeDifficulty(diffs[2]); return;
                    case 'ArrowLeft':
                        if (cur > 0) changeDifficulty(diffs[cur - 1]);
                        return;
                    case 'ArrowRight':
                        if (cur < diffs.length - 1) changeDifficulty(diffs[cur + 1]);
                        return;
                    case 'Space':
                    case 'Enter':
                        ev.preventDefault();
                        triggerIntroStart();
                        return;
                }
                return;
            } else if (store.showGameOver) {
                const maxFocus = store.gameOverWon ? 1 : 0;
                switch (ev.code) {
                    case 'ArrowUp':
                        ev.preventDefault();
                        setStore('gameOverFocus', v => Math.max(0, v - 1));
                        return;
                    case 'ArrowDown':
                        ev.preventDefault();
                        setStore('gameOverFocus', v => Math.min(maxFocus, v + 1));
                        return;
                    case 'Space':
                    case 'Enter':
                        ev.preventDefault();
                        if (store.gameOverWon && store.gameOverFocus === 0) {
                            triggerSurvival();
                        } else {
                            restartGame();
                        }
                        return;
                }
                return;
            } else if (STATE.running) {
                switch (ev.code) {
                    case 'Space':
                        if (STATE.over) return;
                        ev.preventDefault();
                        togglePause();
                        return;
                    case 'Digit1': setSpeed(1); return;
                    case 'Digit2': setSpeed(2); return;
                    case 'Digit3': setSpeed(4); return;
                    case 'Digit4': setSpeed(8); return;
                    case 'Digit5': setSpeed(16); return;
                    case 'Digit6': setSpeed(32); return;
                    case 'Digit7': setSpeed(64); return;
                    case 'Digit8': setSpeed(128); return;
                    case 'Digit9': setSpeed(256); return;
                    case 'Digit0': setSpeed(512); return;
                }
                if (ev.shiftKey) {
                    switch (ev.code) {
                        case 'KeyW': toggleAutoSpawn('worker'); break;
                        case 'KeyS': toggleAutoSpawn('soldier'); break;
                        case 'KeyE': toggleAutoSpawn('scout'); break;
                        case 'KeyD': toggleAutoSpawn('nurse'); break;
                        case 'KeyQ': toggleAutoSpawn('princess'); break;
                        case 'KeyR': toggleAutoBuild('chamber'); break;
                        case 'KeyF': toggleAutoBuild('expand'); break;
                        case 'KeyA': toggleAutoAction('flight'); break;
                    }
                } else {
                    switch (ev.code) {
                        case 'KeyW': ColonyModule.orderAnt('worker'); break;
                        case 'KeyS': ColonyModule.orderAnt('soldier'); break;
                        case 'KeyE': ColonyModule.orderAnt('scout'); break;
                        case 'KeyD': ColonyModule.orderAnt('nurse'); break;
                        case 'KeyQ': ColonyModule.orderAnt('princess'); break;
                        case 'KeyR': ColonyModule.digChamber(); break;
                        case 'KeyF': MapModule.expandSurface(); break;
                        case 'KeyA': ColonyModule.startFlight(); break;
                    }
                }
            }
        });

        // Header lang button
        const langBtn = document.getElementById('lang-btn') as HTMLButtonElement | null;
        if (langBtn) {
            const FLAG_EN = `<svg width="20" height="14" viewBox="0 0 20 14" style="vertical-align:middle;margin-right:4px"><rect width="20" height="14" fill="#012169"/><path d="M0,0 L20,14 M20,0 L0,14" stroke="#fff" stroke-width="3.5"/><path d="M0,0 L20,14 M20,0 L0,14" stroke="#C8102E" stroke-width="2"/><path d="M10,0 V14 M0,7 H20" stroke="#fff" stroke-width="5"/><path d="M10,0 V14 M0,7 H20" stroke="#C8102E" stroke-width="3"/></svg>EN`;
            const FLAG_RU = `<svg width="20" height="14" viewBox="0 0 20 14" style="vertical-align:middle;margin-right:4px"><rect width="20" height="4.67" fill="#fff"/><rect y="4.67" width="20" height="4.67" fill="#0039A6"/><rect y="9.33" width="20" height="4.67" fill="#D52B1E"/></svg>RU`;
            const updateLangBtn = (): void => { langBtn.innerHTML = getLang() === 'en' ? FLAG_EN : FLAG_RU; };
            updateLangBtn();
            langBtn.addEventListener('click', () => { toggleLang(); updateLangBtn(); });
        }
    },

    showIntroModal,
    hideIntroModal,
    update,
    setPerfMetrics,
    hideGameOverModal,
    reset,
    setGameActive,
};
