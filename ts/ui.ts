import { CONFIG } from './config';
import { STATE, AntType } from './state';
import { STATS } from './stats';
import { ColonyModule } from './colony';
import { MapModule } from './map';
import { getLang, setLang, t, applyTranslations, type Lang } from './i18n';
import { getDifficulty, setDifficulty, applyDifficulty, type Difficulty } from './difficulty';

interface UIElements {
    food: HTMLElement | null;
    pop: HTMLElement | null;
    waveNum: HTMLElement | null;
    waveEnemies: HTMLElement | null;
    queenHp: HTMLElement | null;
    queenBar: HTMLElement | null;
    btnWorker: HTMLButtonElement | null;
    btnSoldier: HTMLButtonElement | null;
    btnScout: HTMLButtonElement | null;
    btnNurse: HTMLButtonElement | null;
    btnPrincess: HTMLButtonElement | null;
    btnChamber: HTMLButtonElement | null;
    modal: HTMLElement | null;
    modalTitle: HTMLElement | null;
    modalMsg: HTMLElement | null;
    eggQueue: HTMLElement | null;
    btnRestart: HTMLButtonElement | null;
    btnSurvival: HTMLButtonElement | null;
    btnExpand: HTMLButtonElement | null;
    expandCost: HTMLElement | null;
    chamberCost: HTMLElement | null;
    uiSurface: HTMLElement | null;
    uiChambers: HTMLElement | null;
    cntWorker: HTMLElement | null;
    cntSoldier: HTMLElement | null;
    cntScout: HTMLElement | null;
    cntNurse: HTMLElement | null;
    cntPrincess: HTMLElement | null;
    goalCheckQueen: HTMLElement | null;
    goalCheckChambers: HTMLElement | null;
    goalProgChambers: HTMLElement | null;
    goalCheckSurface: HTMLElement | null;
    goalProgSurface: HTMLElement | null;
    goalCheckPrincesses: HTMLElement | null;
    goalProgPrincesses: HTMLElement | null;
    goalCheckFlight: HTMLElement | null;
    goalProgFlight: HTMLElement | null;
    btnStartFlight: HTMLButtonElement | null;
    flightStars: HTMLElement | null;
}

declare const GameMain: {
    restart: () => void;
    start: () => void;
    setSpeed: (mult: number) => void;
    setGameActive?: (v: boolean) => void;
};

const UI = (() => {
    const els: UIElements = {
        food: null,
        pop: null,
        waveNum: null,
        waveEnemies: null,
        queenHp: null,
        queenBar: null,
        eggQueue: null,
        btnWorker: null,
        btnSoldier: null,
        btnScout: null,
        btnNurse: null,
        btnPrincess: null,
        btnChamber: null,
        modal: null,
        modalTitle: null,
        modalMsg: null,
        btnRestart: null,
        btnSurvival: null,
        btnExpand: null,
        expandCost: null,
        chamberCost: null,
        uiSurface: null,
        uiChambers: null,
        cntWorker: null,
        cntSoldier: null,
        cntScout: null,
        cntNurse: null,
        cntPrincess: null,
        goalCheckQueen: null,
        goalCheckChambers: null,
        goalProgChambers: null,
        goalCheckSurface: null,
        goalProgSurface: null,
        goalCheckPrincesses: null,
        goalProgPrincesses: null,
        goalCheckFlight: null,
        goalProgFlight: null,
        btnStartFlight: null,
        flightStars: null,
    };
    const autoSpawn: Partial<Record<AntType, boolean>> = { worker: false, soldier: false, scout: false, nurse: false, princess: false };
    let autoSpawnTurn = 0;
    let autoChamber = false;
    let autoExpand = false;
    let autoFlight = false;
    let gameActive = false;

    let _diffKeyHandler: ((e: KeyboardEvent) => void) | null = null;
    let _startKeyHandler: ((e: KeyboardEvent) => void) | null = null;
    let _modalKeyHandler: ((e: KeyboardEvent) => void) | null = null;

    function toggleAuto(type: AntType): void {
        autoSpawn[type] = !autoSpawn[type];
        autoSpawnTurn = 0;
    }

    function init(): void {
        els.food = document.getElementById('ui-food');
        els.pop = document.getElementById('ui-pop');
        els.waveNum = document.getElementById('ui-wave-num');
        els.waveEnemies = document.getElementById('ui-wave-enemies');
        els.queenHp = document.getElementById('ui-queen-hp');
        els.queenBar = document.getElementById('ui-queen-bar');
        els.eggQueue = document.getElementById('egg-queue');
        els.btnWorker = document.getElementById('btn-worker') as HTMLButtonElement | null;
        els.btnSoldier = document.getElementById('btn-soldier') as HTMLButtonElement | null;
        els.btnScout = document.getElementById('btn-scout') as HTMLButtonElement | null;
        els.btnNurse = document.getElementById('btn-nurse') as HTMLButtonElement | null;
        els.btnPrincess = document.getElementById('btn-princess') as HTMLButtonElement | null;
        els.btnChamber = document.getElementById('btn-chamber') as HTMLButtonElement | null;
        els.modal = document.getElementById('modal');
        els.modalTitle = document.getElementById('modal-title');
        els.modalMsg = document.getElementById('modal-msg');
        els.btnRestart = document.getElementById('btn-restart') as HTMLButtonElement | null;
        els.btnSurvival = document.getElementById('btn-survival') as HTMLButtonElement | null;
        els.btnExpand = document.getElementById('btn-expand') as HTMLButtonElement | null;
        els.expandCost = document.getElementById('expand-cost');
        els.chamberCost = document.getElementById('chamber-cost');
        els.uiSurface = document.getElementById('ui-surface');
        els.uiChambers = document.getElementById('ui-chambers');
        els.cntWorker = document.getElementById('cnt-worker');
        els.cntSoldier = document.getElementById('cnt-soldier');
        els.cntScout = document.getElementById('cnt-scout');
        els.cntNurse = document.getElementById('cnt-nurse');
        els.cntPrincess = document.getElementById('cnt-princess');
        els.goalCheckQueen = document.getElementById('goal-check-queen');
        els.goalCheckChambers = document.getElementById('goal-check-chambers');
        els.goalProgChambers = document.getElementById('goal-prog-chambers');
        els.goalCheckSurface = document.getElementById('goal-check-surface');
        els.goalProgSurface = document.getElementById('goal-prog-surface');
        els.goalCheckPrincesses = document.getElementById('goal-check-princesses');
        els.goalProgPrincesses = document.getElementById('goal-prog-princesses');
        els.goalCheckFlight = document.getElementById('goal-check-flight');
        els.goalProgFlight = document.getElementById('goal-prog-flight');
        els.btnStartFlight = document.getElementById('btn-start-flight') as HTMLButtonElement | null;
        els.flightStars = document.getElementById('flight-stars');

        // Shift+click toggles auto; plain click spawns once
        const spawnBtns: { el: HTMLButtonElement | null; type: AntType }[] = [
            { el: els.btnWorker, type: 'worker' },
            { el: els.btnSoldier, type: 'soldier' },
            { el: els.btnScout, type: 'scout' },
            { el: els.btnNurse, type: 'nurse' },
            { el: els.btnPrincess, type: 'princess' },
        ];
        for (const { el, type } of spawnBtns) {
            if (!el) continue;
            el.addEventListener('mousedown', (e) => {
                if (e.shiftKey && e.button === 0) {
                    e.preventDefault();
                    toggleAuto(type);
                }
            });
            el.onclick = (e) => {
                if (e.shiftKey) return; // handled by mousedown
                if (el.classList.contains('btn-disabled')) return;
                ColonyModule.orderAnt(type);
            };
        }

        if (els.btnChamber) {
            els.btnChamber.addEventListener('mousedown', (e) => { if (e.shiftKey && e.button === 0) { e.preventDefault(); autoChamber = !autoChamber; } });
            els.btnChamber.onclick = (e) => { if (e.shiftKey) return; ColonyModule.digChamber(); };
        }
        if (els.btnExpand) {
            els.btnExpand.addEventListener('mousedown', (e) => { if (e.shiftKey && e.button === 0) { e.preventDefault(); autoExpand = !autoExpand; } });
            els.btnExpand.onclick = (e) => { if (e.shiftKey) return; MapModule.expandSurface(); };
        }
        if (els.btnRestart) els.btnRestart.onclick = () => GameMain.restart();
        if (els.btnSurvival) {
            els.btnSurvival.onclick = () => {
                STATE.survival = true;
                STATE.over = false;
                hideModal();
                GameMain.start();
            };
        }
        if (els.btnStartFlight) {
            els.btnStartFlight.addEventListener('mousedown', (e) => {
                if (e.shiftKey && e.button === 0) { e.preventDefault(); autoFlight = !autoFlight; }
            });
            els.btnStartFlight.onclick = (e) => {
                if (e.shiftKey) return;
                if (els.btnStartFlight!.classList.contains('btn-disabled')) return;
                ColonyModule.startFlight();
            };
        }

        const FLAG_EN = `<svg width="20" height="14" viewBox="0 0 20 14" style="vertical-align:middle;margin-right:4px">
            <rect width="20" height="14" fill="#012169"/>
            <path d="M0,0 L20,14 M20,0 L0,14" stroke="#fff" stroke-width="3.5"/>
            <path d="M0,0 L20,14 M20,0 L0,14" stroke="#C8102E" stroke-width="2"/>
            <path d="M10,0 V14 M0,7 H20" stroke="#fff" stroke-width="5"/>
            <path d="M10,0 V14 M0,7 H20" stroke="#C8102E" stroke-width="3"/>
        </svg>`;
        const FLAG_RU = `<svg width="20" height="14" viewBox="0 0 20 14" style="vertical-align:middle;margin-right:4px">
            <rect width="20" height="4.67" fill="#fff"/>
            <rect y="4.67" width="20" height="4.67" fill="#0039A6"/>
            <rect y="9.33" width="20" height="4.67" fill="#D52B1E"/>
        </svg>`;

        const langBtn = document.getElementById('lang-btn') as HTMLButtonElement | null;
        const updateLangBtn = (): void => {
            if (!langBtn) return;
            const lang = getLang();
            langBtn.innerHTML = lang === 'en' ? `${FLAG_EN}EN` : `${FLAG_RU}RU`;
        };
        updateLangBtn();
        if (langBtn) {
            langBtn.addEventListener('click', () => {
                const next: Lang = getLang() === 'en' ? 'ru' : 'en';
                setLang(next);
                applyTranslations();
                refreshDynamicTexts();
                updateDifficultyBadge();
                updateDifficultySelector();
                updateLangBtn();
            });
        }

        applyTranslations();
        refreshDynamicTexts();
        updateDifficultyBadge();

        document.querySelectorAll<HTMLElement>('.diff-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const d = btn.dataset.diff as Difficulty;
                setDifficulty(d);
                applyDifficulty();
                STATE.food = CONFIG.START_FOOD;
                refreshDynamicTexts();
                updateDifficultyBadge();
                updateDifficultySelector();
            });
        });

        document.querySelectorAll('.speed-btn').forEach(btn => {
            const mult = Number((btn as HTMLElement).dataset.mult);
            btn.addEventListener('click', () => mult === 0 ? togglePause() : setSpeed(mult));
        });

        document.addEventListener('keydown', (ev) => {
            if (gameActive) {
                switch (ev.code) {
                    case 'Space': if (STATE.over) return; ev.preventDefault(); togglePause(); return;
                    case 'Digit1': setSpeed(1); return;
                    case 'Digit2': setSpeed(2); return;
                    case 'Digit3': setSpeed(4); return;
                    case 'Digit4': setSpeed(8); return;
                }
            }
            if (!STATE.running) return;
            if (ev.shiftKey) {
                switch (ev.code) {
                    case 'KeyW': toggleAuto('worker'); break;
                    case 'KeyS': toggleAuto('soldier'); break;
                    case 'KeyE': toggleAuto('scout'); break;
                    case 'KeyD': toggleAuto('nurse'); break;
                    case 'KeyQ': toggleAuto('princess'); break;
                    case 'KeyR': autoChamber = !autoChamber; break;
                    case 'KeyF': autoExpand = !autoExpand; break;
                    case 'KeyA': autoFlight = !autoFlight; break;
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
                    case 'KeyA': { ColonyModule.startFlight(); break; }
                }
            }
        });
    }

    // Called every game tick from main loop
    function tickAutoSpawn(): void {
        if (!STATE.running || !STATE.queen) return;

        if (autoChamber && ColonyModule.canDigChamber() && STATE.food >= STATE.chamberCost()) {
            ColonyModule.digChamber();
        }
        if (autoExpand && STATE.surfaceRows < CONFIG.SURFACE_ROWS_MAX && STATE.food >= STATE.expandCost()) {
            MapModule.expandSurface();
        }
        if (autoFlight) ColonyModule.startFlight();

        if ((STATE.queen.eggQueue?.length ?? 0) > 0) return;

        const types: AntType[] = ['worker', 'soldier', 'scout', 'nurse', 'princess'].filter(t => autoSpawn[t]) as AntType[];
        if (types.length === 0) return;

        autoSpawnTurn = autoSpawnTurn % types.length;
        let type = types[autoSpawnTurn];

        if (type === 'nurse' && !ColonyModule.canSpawnNurse()) {
            autoSpawnTurn = (autoSpawnTurn + 1) % types.length;
            type = types[autoSpawnTurn];
            if (type === 'nurse') return;
        }
        if (type === 'princess' && !ColonyModule.canSpawnPrincess()) {
            autoSpawnTurn = (autoSpawnTurn + 1) % types.length;
            type = types[autoSpawnTurn];
            if (type === 'princess') return;
        }

        if (ColonyModule.orderAnt(type)) {
            autoSpawnTurn = (autoSpawnTurn + 1) % types.length;
        }
    }

    function reset(): void {
        autoSpawn.worker = false;
        autoSpawn.soldier = false;
        autoSpawn.scout = false;
        autoSpawn.nurse = false;
        autoSpawn.princess = false;
        autoSpawnTurn = 0;
        autoChamber = false;
        autoExpand = false;
        autoFlight = false;
        gameActive = false;
    }

    function setGameActive(v: boolean): void { gameActive = v; if (v) setSpeed(1); }

    function update(): void {
        const pending = STATE.queen?.eggQueue ?? [];
        const pop = STATE.ants.length + pending.length;
        const cap = STATE.popCap();

        if (els.food) els.food.textContent = Math.floor(STATE.food) + ' 🍒';
        if (els.pop) els.pop.textContent = `${pop} / ${cap}`;
        if (els.waveNum) els.waveNum.textContent = STATE.wave.toString();
        if (els.waveEnemies) els.waveEnemies.textContent = STATE.waveEnemyCount.toString();
        if (els.queenHp) els.queenHp.textContent = Math.max(0, Math.floor(STATE.queenHp)).toString();
        if (els.queenBar) els.queenBar.style.width = Math.max(0, (STATE.queenHp / CONFIG.QUEEN_HP) * 100) + '%';

        if (els.eggQueue) {
            const MAX_DOTS = 14;
            const colors: Record<string, string> = { worker: '#d4a96a', soldier: '#cc3333', scout: '#e8d44d', nurse: '#7ec8e3', princess: '#cc44cc' };
            const labels: Record<string, string> = { worker: 'W', soldier: 'S', scout: 'E', nurse: 'N', princess: 'Q' };
            if (pending.length === 0) {
                els.eggQueue.textContent = '—';
            } else {
                const shown = pending.slice(0, MAX_DOTS);
                const overflow = pending.length - shown.length;
                els.eggQueue.innerHTML = shown.map(o =>
                    `<span class="eq-dot" style="background:${colors[o]}" title="${o}">${labels[o]}</span>`
                ).join('') + (overflow > 0 ? `<span class="eq-overflow">+${overflow}</span>` : '');
            }
        }

        // Disable buttons if not enough food or pop cap (pending orders counted toward pop)
        if (els.btnWorker) els.btnWorker.classList.toggle('btn-disabled', STATE.food < CONFIG.COST_WORKER || pop >= cap);
        if (els.btnSoldier) els.btnSoldier.classList.toggle('btn-disabled', STATE.food < CONFIG.COST_SOLDIER || pop >= cap);
        if (els.btnScout) els.btnScout.classList.toggle('btn-disabled', STATE.food < CONFIG.COST_SCOUT || pop >= cap);
        if (els.btnNurse) els.btnNurse.classList.toggle('btn-disabled', STATE.food < CONFIG.COST_NURSE || pop >= cap || !ColonyModule.canSpawnNurse());
        if (els.btnPrincess) els.btnPrincess.classList.toggle('btn-disabled',
            STATE.food < CONFIG.COST_PRINCESS || pop >= cap || !ColonyModule.canSpawnPrincess());

        const chamberMaxed = !ColonyModule.canDigChamber();
        const expandMaxed = STATE.surfaceRows >= CONFIG.SURFACE_ROWS_MAX;
        const chamberCost = STATE.chamberCost();
        const expandCost = STATE.expandCost();

        if (els.btnChamber) { els.btnChamber.disabled = chamberMaxed || STATE.food < chamberCost; els.btnChamber.classList.toggle('btn-auto', autoChamber && !chamberMaxed); }
        if (els.btnExpand) { els.btnExpand.disabled = expandMaxed || STATE.food < expandCost; els.btnExpand.classList.toggle('btn-auto', autoExpand && !expandMaxed); }
        if (els.chamberCost) els.chamberCost.textContent = chamberMaxed ? t('cost_max') : '🍒 ' + chamberCost;
        if (els.expandCost) els.expandCost.textContent = expandMaxed ? t('cost_max') : '🍒 ' + expandCost;
        if (els.uiSurface) els.uiSurface.textContent = STATE.surfaceRows.toString();
        if (els.uiChambers) els.uiChambers.textContent = STATE.chambers.toString();

        // Auto-mode button indicator
        if (els.btnWorker) els.btnWorker.classList.toggle('btn-auto', !!autoSpawn.worker);
        if (els.btnSoldier) els.btnSoldier.classList.toggle('btn-auto', !!autoSpawn.soldier);
        if (els.btnScout) els.btnScout.classList.toggle('btn-auto', !!autoSpawn.scout);
        if (els.btnNurse) els.btnNurse.classList.toggle('btn-auto', !!autoSpawn.nurse);
        if (els.btnPrincess) els.btnPrincess.classList.toggle('btn-auto', !!autoSpawn.princess);

        // Legend counts (include pending orders in eggQueue)
        const cnt = (type: AntType): number => STATE.ants.filter(a => a.type === type).length + pending.filter(o => o === type).length;
        if (els.cntWorker) els.cntWorker.textContent = cnt('worker').toString();
        if (els.cntSoldier) els.cntSoldier.textContent = cnt('soldier').toString();
        if (els.cntScout) els.cntScout.textContent = cnt('scout').toString();
        if (els.cntNurse) els.cntNurse.textContent = cnt('nurse').toString();
        if (els.cntPrincess) els.cntPrincess.textContent = cnt('princess').toString();

        // Goals
        const princessCount = STATE.ants.filter(a => a.type === 'princess' && a.lifestage === null).length;
        const queenAlive = STATE.queen !== null && STATE.queenHp > 0;
        const chambersGoal = CONFIG.GOAL_CHAMBERS;
        const chambersReached = STATE.chambers >= chambersGoal;
        const surfaceGoal = CONFIG.SURFACE_ROWS_MAX;
        const surfaceReached = STATE.surfaceRows >= surfaceGoal;
        const princessesReached = princessCount >= CONFIG.PRINCESS_LIMIT;

        const setGoal = (check: HTMLElement | null, done: boolean): void => {
            if (!check) return;
            check.textContent = done ? '☑' : '☐';
            check.classList.toggle('goal-done', done);
        };
        setGoal(els.goalCheckQueen, queenAlive);
        setGoal(els.goalCheckChambers, chambersReached);
        setGoal(els.goalCheckSurface, surfaceReached);
        setGoal(els.goalCheckPrincesses, princessesReached);
        setGoal(els.goalCheckFlight, STATE.flightStarted);

        if (els.goalProgChambers) els.goalProgChambers.textContent = `${Math.min(STATE.chambers, chambersGoal)}/${chambersGoal}`;
        if (els.goalProgSurface) els.goalProgSurface.textContent = `${Math.min(STATE.surfaceRows, surfaceGoal)}/${surfaceGoal}`;
        if (els.goalProgPrincesses) els.goalProgPrincesses.textContent = `${Math.min(princessCount, CONFIG.PRINCESS_LIMIT)}/${CONFIG.PRINCESS_LIMIT}`;

        if (STATE.flightStarted) {
            if (els.btnStartFlight) els.btnStartFlight.style.display = 'none';
            if (els.goalProgFlight) {
                els.goalProgFlight.style.display = '';
                els.goalProgFlight.textContent = `${STATE.flightEscaped}/${STATE.flightTotal}`;
            }
        } else {
            if (els.btnStartFlight) {
                els.btnStartFlight.style.display = '';
                els.btnStartFlight.classList.toggle('btn-disabled', !princessesReached);
                els.btnStartFlight.classList.toggle('btn-auto', autoFlight);
            }
            if (els.goalProgFlight) els.goalProgFlight.style.display = 'none';
        }

        if (els.flightStars) {
            if (STATE.completedFlights > 0) {
                els.flightStars.style.display = '';
                const big = Math.floor(STATE.completedFlights / 10);
                const small = STATE.completedFlights % 10;
                els.flightStars.innerHTML =
                    '<span class="star-big">★</span>'.repeat(big) +
                    '<span class="star-small">★</span>'.repeat(small);
            } else {
                els.flightStars.style.display = 'none';
            }
        }

        if (STATE.over && els.modal?.classList.contains('hidden')) showModal();
    }

    function showModal(): void {
        if (!els.modal || !els.modalTitle || !els.modalMsg) return;
        els.modal.classList.remove('hidden');
        if (STATE.won) {
            els.modalTitle.textContent = t('modal_victory_title');
            els.modalMsg.textContent = t('modal_victory_msg').replace('{wave}', STATE.wave.toString());
            els.modal.classList.add('won');
            if (els.btnSurvival) els.btnSurvival.classList.remove('hidden');
        } else {
            els.modalTitle.textContent = t('modal_defeat_title');
            els.modalMsg.textContent = t('modal_defeat_msg');
            els.modal.classList.remove('won');
            if (els.btnSurvival) els.btnSurvival.classList.add('hidden');
        }

        // Collect visible modal buttons in DOM order and focus the restart button
        const getModalBtns = (): HTMLButtonElement[] =>
            Array.from(els.modal!.querySelectorAll<HTMLButtonElement>('button:not(.hidden)'));
        setTimeout(() => els.btnRestart?.focus(), 0);

        _modalKeyHandler = (ev: KeyboardEvent): void => {
            const btns = getModalBtns();
            if (!btns.length) return;
            if (ev.code === 'Space' || ev.code === 'Enter') {
                ev.preventDefault();
                (btns.find(b => b === document.activeElement) ?? btns[0]).click();
                return;
            }
            if (ev.code === 'ArrowDown' || ev.code === 'ArrowUp') {
                ev.preventDefault();
                const idx = btns.indexOf(document.activeElement as HTMLButtonElement);
                const next = ev.code === 'ArrowDown'
                    ? (idx + 1) % btns.length
                    : (idx + btns.length - 1) % btns.length;
                btns[next].focus();
            }
        };
        document.addEventListener('keydown', _modalKeyHandler);
        const statsEl = document.getElementById('modal-stats');
        if (statsEl) {
            statsEl.classList.remove('hidden');
            (document.getElementById('stat-max-ants') as HTMLElement).textContent = STATS.maxAnts.toString();
            (document.getElementById('stat-produced') as HTMLElement).textContent = STATS.totalAntsProduced.toString();
            (document.getElementById('stat-food') as HTMLElement).textContent = Math.floor(STATS.totalFoodCollected).toString();
            (document.getElementById('stat-kills') as HTMLElement).textContent = STATS.totalEnemiesKilled.toString();
            (document.getElementById('stat-princesses') as HTMLElement).textContent = STATS.totalPrincessesFled.toString();
            (document.getElementById('stat-stars') as HTMLElement).textContent = STATE.completedFlights.toString();
        }
    }

    let currentSpeed = 1;
    let prevSpeed = 1;

    function setSpeed(mult: number): void {
        if (mult !== 0) prevSpeed = mult;
        currentSpeed = mult;
        GameMain.setSpeed(mult);
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.classList.toggle('active', Number((btn as HTMLElement).dataset.mult) === mult);
        });
    }

    function togglePause(): void {
        setSpeed(currentSpeed === 0 ? prevSpeed : 0);
    }

    function hideModal(): void {
        if (!els.modal) return;
        els.modal.classList.add('hidden');
        els.modal.classList.remove('won');
        if (els.btnSurvival) els.btnSurvival.classList.add('hidden');
        document.getElementById('modal-stats')?.classList.add('hidden');
        if (_modalKeyHandler) {
            document.removeEventListener('keydown', _modalKeyHandler);
            _modalKeyHandler = null;
        }
    }

    function showGoalsPopup(onOk: () => void): void {
        const modal = document.getElementById('intro-modal');
        if (modal) modal.classList.remove('hidden');

        refreshDynamicTexts();
        updateDifficultyBadge();
        updateDifficultySelector();

        const doStart = (): void => {
            hideGoalsPopup();
            onOk();
        };

        _startKeyHandler = (ev: KeyboardEvent): void => {
            if (ev.code === 'Space' || ev.code === 'Enter') {
                ev.preventDefault();
                doStart();
            }
        };
        const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
        _diffKeyHandler = (ev: KeyboardEvent): void => {
            let d: Difficulty | null = null;
            if (ev.code === 'Digit1') d = 'easy';
            else if (ev.code === 'Digit2') d = 'medium';
            else if (ev.code === 'Digit3') d = 'hard';
            else if (ev.code === 'ArrowRight' || ev.code === 'ArrowLeft') {
                ev.preventDefault();
                const cur = difficulties.indexOf(getDifficulty());
                const next = ev.code === 'ArrowRight'
                    ? (cur + 1) % difficulties.length
                    : (cur + difficulties.length - 1) % difficulties.length;
                d = difficulties[next];
            }
            if (!d) return;
            setDifficulty(d);
            applyDifficulty();
            STATE.food = CONFIG.START_FOOD;
            refreshDynamicTexts();
            updateDifficultyBadge();
            updateDifficultySelector();
        };

        const btn = document.getElementById('intro-modal-ok') as HTMLButtonElement | null;
        if (btn) btn.onclick = doStart;
        document.addEventListener('keydown', _startKeyHandler);
        document.addEventListener('keydown', _diffKeyHandler);
    }

    function updateDifficultySelector(): void {
        const diff = getDifficulty();
        document.querySelectorAll<HTMLElement>('.diff-btn').forEach(btn => {
            const d = btn.dataset.diff as Difficulty;
            btn.classList.toggle('active', d === diff);
        });
        const descEl = document.getElementById('difficulty-desc');
        if (descEl) descEl.textContent = t(`diff_desc_${diff}` as Parameters<typeof t>[0]);
    }

    function updateDifficultyBadge(): void {
        const badge = document.getElementById('difficulty-badge');
        if (!badge) return;
        const diff = getDifficulty();
        const icons: Record<Difficulty, string> = { easy: '🌱', medium: '⚔️', hard: '💀' };
        badge.textContent = `${icons[diff]} ${t(`diff_${diff}` as Parameters<typeof t>[0])}`;
    }

    function refreshDynamicTexts(): void {
        const n = CONFIG.PRINCESS_LIMIT;
        const labelEl = document.getElementById('goal-princesses-label');
        const introEl = document.getElementById('intro-goal2');
        if (labelEl) labelEl.textContent = t('goal_princesses').replace('{n}', String(n));
        if (introEl) introEl.innerHTML = t('intro_goal2').replace('{n}', String(n));
        const progEl = document.getElementById('goal-prog-princesses');
        if (progEl) progEl.textContent = `0/${n}`;
        const flightProgEl = document.getElementById('goal-prog-flight');
        if (flightProgEl) flightProgEl.textContent = `0/${n}`;
        if (els.food) els.food.textContent = CONFIG.START_FOOD + ' 🍒';
    }

    function hideGoalsPopup(): void {
        const modal = document.getElementById('intro-modal');
        if (modal) modal.classList.add('hidden');
        if (_startKeyHandler) { document.removeEventListener('keydown', _startKeyHandler); _startKeyHandler = null; }
        if (_diffKeyHandler) { document.removeEventListener('keydown', _diffKeyHandler); _diffKeyHandler = null; }
    }

    return { init, update, hideModal, showGoalsPopup, hideGoalsPopup, tickAutoSpawn, reset, setGameActive };
})();

export { UI as UIModule };