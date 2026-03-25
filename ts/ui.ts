import { CONFIG } from './config';
import { STATE, AntType } from './state';
import { ColonyModule } from './colony';
import { MapModule } from './map';

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
    btnChamber: HTMLButtonElement | null;
    modal: HTMLElement | null;
    modalTitle: HTMLElement | null;
    modalMsg: HTMLElement | null;
    eggQueue: HTMLElement | null;
    btnRestart: HTMLButtonElement | null;
    btnExpand: HTMLButtonElement | null;
    expandCost: HTMLElement | null;
    chamberCost: HTMLElement | null;
    uiSurface: HTMLElement | null;
    uiChambers: HTMLElement | null;
    cntWorker: HTMLElement | null;
    cntSoldier: HTMLElement | null;
    cntScout: HTMLElement | null;
    cntNurse: HTMLElement | null;
    cntBeetle: HTMLElement | null;
    cntSpider: HTMLElement | null;
}

declare const GameMain: {
    restart: () => void;
    setSpeed: (mult: number) => void;
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
        btnChamber: null,
        modal: null,
        modalTitle: null,
        modalMsg: null,
        btnRestart: null,
        btnExpand: null,
        expandCost: null,
        chamberCost: null,
        uiSurface: null,
        uiChambers: null,
        cntWorker: null,
        cntSoldier: null,
        cntScout: null,
        cntNurse: null,
        cntBeetle: null,
        cntSpider: null,
    };
    const autoSpawn: Partial<Record<AntType, boolean>> = { worker: false, soldier: false, scout: false, nurse: false };
    let autoSpawnTurn = 0;
    let autoChamber = false;
    let autoExpand = false;

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
        els.btnChamber = document.getElementById('btn-chamber') as HTMLButtonElement | null;
        els.modal = document.getElementById('modal');
        els.modalTitle = document.getElementById('modal-title');
        els.modalMsg = document.getElementById('modal-msg');
        els.btnRestart = document.getElementById('btn-restart') as HTMLButtonElement | null;
        els.btnExpand = document.getElementById('btn-expand') as HTMLButtonElement | null;
        els.expandCost = document.getElementById('expand-cost');
        els.chamberCost = document.getElementById('chamber-cost');
        els.uiSurface = document.getElementById('ui-surface');
        els.uiChambers = document.getElementById('ui-chambers');
        els.cntWorker = document.getElementById('cnt-worker');
        els.cntSoldier = document.getElementById('cnt-soldier');
        els.cntScout = document.getElementById('cnt-scout');
        els.cntNurse = document.getElementById('cnt-nurse');
        els.cntBeetle = document.getElementById('cnt-beetle');
        els.cntSpider = document.getElementById('cnt-spider');

        // Shift+click toggles auto; plain click spawns once
        const spawnBtns: { el: HTMLButtonElement | null; type: AntType }[] = [
            { el: els.btnWorker, type: 'worker' },
            { el: els.btnSoldier, type: 'soldier' },
            { el: els.btnScout, type: 'scout' },
            { el: els.btnNurse, type: 'nurse' },
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

        document.querySelectorAll('.speed-btn').forEach(btn => {
            const mult = Number((btn as HTMLElement).dataset.mult);
            btn.addEventListener('click', () => mult === 0 ? togglePause() : setSpeed(mult));
        });

        document.addEventListener('keydown', (ev) => {
            switch (ev.code) {
                case 'Space': ev.preventDefault(); togglePause(); return;
                case 'Digit1': setSpeed(1); return;
                case 'Digit2': setSpeed(2); return;
                case 'Digit3': setSpeed(4); return;
                case 'Digit4': setSpeed(8); return;
            }
            if (!STATE.running) return;
            if (ev.shiftKey) {
                switch (ev.code) {
                    case 'KeyW': toggleAuto('worker'); break;
                    case 'KeyS': toggleAuto('soldier'); break;
                    case 'KeyE': toggleAuto('scout'); break;
                    case 'KeyN': toggleAuto('nurse'); break;
                    case 'KeyD': autoChamber = !autoChamber; break;
                    case 'KeyF': autoExpand = !autoExpand; break;
                }
            } else {
                switch (ev.code) {
                    case 'KeyW': ColonyModule.orderAnt('worker'); break;
                    case 'KeyS': ColonyModule.orderAnt('soldier'); break;
                    case 'KeyE': ColonyModule.orderAnt('scout'); break;
                    case 'KeyN': ColonyModule.orderAnt('nurse'); break;
                    case 'KeyD': ColonyModule.digChamber(); break;
                    case 'KeyF': MapModule.expandSurface(); break;
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

        if ((STATE.queen.eggQueue?.length ?? 0) > 0) return;

        const types: AntType[] = ['worker', 'soldier', 'scout', 'nurse'].filter(t => autoSpawn[t]) as AntType[];
        if (types.length === 0) return;

        autoSpawnTurn = autoSpawnTurn % types.length;
        let type = types[autoSpawnTurn];

        if (type === 'nurse' && !ColonyModule.canSpawnNurse()) {
            autoSpawnTurn = (autoSpawnTurn + 1) % types.length;
            type = types[autoSpawnTurn];
            if (type === 'nurse') return;
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
        autoSpawnTurn = 0;
        autoChamber = false;
        autoExpand = false;
    }

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
            const colors: Record<string, string> = { worker: '#d4a96a', soldier: '#cc3333', scout: '#e8d44d', nurse: '#7ec8e3' };
            const labels: Record<string, string> = { worker: 'W', soldier: 'S', scout: 'E', nurse: 'N' };
            if (pending.length === 0) {
                els.eggQueue.textContent = '—';
            } else {
                const shown = pending.slice(0, MAX_DOTS);
                const overflow = pending.length - shown.length;
                els.eggQueue.innerHTML = shown.map(o =>
                    `<span class="eq-dot" style="background:${colors[o.type]}" title="${o.type}">${labels[o.type]}</span>`
                ).join('') + (overflow > 0 ? `<span class="eq-overflow">+${overflow}</span>` : '');
            }
        }

        // Disable buttons if not enough food or pop cap (pending orders counted toward pop)
        if (els.btnWorker) els.btnWorker.classList.toggle('btn-disabled', STATE.food < CONFIG.COST_WORKER || pop >= cap);
        if (els.btnSoldier) els.btnSoldier.classList.toggle('btn-disabled', STATE.food < CONFIG.COST_SOLDIER || pop >= cap);
        if (els.btnScout) els.btnScout.classList.toggle('btn-disabled', STATE.food < CONFIG.COST_SCOUT || pop >= cap);
        if (els.btnNurse) els.btnNurse.classList.toggle('btn-disabled', STATE.food < CONFIG.COST_NURSE || pop >= cap || !ColonyModule.canSpawnNurse());

        const chamberMaxed = !ColonyModule.canDigChamber();
        const expandMaxed = STATE.surfaceRows >= CONFIG.SURFACE_ROWS_MAX;
        const chamberCost = STATE.chamberCost();
        const expandCost = STATE.expandCost();

        if (els.btnChamber) { els.btnChamber.disabled = chamberMaxed || STATE.food < chamberCost; els.btnChamber.classList.toggle('btn-auto', autoChamber && !chamberMaxed); }
        if (els.btnExpand) { els.btnExpand.disabled = expandMaxed || STATE.food < expandCost; els.btnExpand.classList.toggle('btn-auto', autoExpand && !expandMaxed); }
        if (els.chamberCost) els.chamberCost.textContent = chamberMaxed ? 'MAX' : '🍒 ' + chamberCost;
        if (els.expandCost) els.expandCost.textContent = expandMaxed ? 'MAX' : '🍒 ' + expandCost;
        if (els.uiSurface) els.uiSurface.textContent = STATE.surfaceRows.toString();
        if (els.uiChambers) els.uiChambers.textContent = STATE.chambers.toString();

        // Auto-mode button indicator
        if (els.btnWorker) els.btnWorker.classList.toggle('btn-auto', !!autoSpawn.worker);
        if (els.btnSoldier) els.btnSoldier.classList.toggle('btn-auto', !!autoSpawn.soldier);
        if (els.btnScout) els.btnScout.classList.toggle('btn-auto', !!autoSpawn.scout);
        if (els.btnNurse) els.btnNurse.classList.toggle('btn-auto', !!autoSpawn.nurse);

        // Legend counts (include pending orders in eggQueue)
        const cnt = (type: AntType): number => STATE.ants.filter(a => a.type === type).length + pending.filter(o => o.type === type).length;
        if (els.cntWorker) els.cntWorker.textContent = cnt('worker').toString();
        if (els.cntSoldier) els.cntSoldier.textContent = cnt('soldier').toString();
        if (els.cntScout) els.cntScout.textContent = cnt('scout').toString();
        if (els.cntNurse) els.cntNurse.textContent = cnt('nurse').toString();
        if (els.cntBeetle) els.cntBeetle.textContent = STATE.enemies.filter(e => e.type === 'beetle').length.toString();
        if (els.cntSpider) els.cntSpider.textContent = STATE.enemies.filter(e => e.type === 'spider').length.toString();

        if (STATE.over) showModal();
    }

    function showModal(): void {
        if (!els.modal || !els.modalTitle || !els.modalMsg) return;
        els.modal.classList.remove('hidden');
        if (STATE.won) {
            els.modalTitle.textContent = 'Victory!';
            els.modalMsg.textContent = `Your colony conquered the map in wave ${STATE.wave}!`;
            els.modal.classList.add('won');
        } else {
            els.modalTitle.textContent = 'Defeat';
            els.modalMsg.textContent = 'Your queen has fallen. The colony is lost.';
            els.modal.classList.remove('won');
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
    }

    function showGoalsPopup(onOk: () => void): void {
        const modal = document.getElementById('intro-modal');
        if (modal) modal.classList.remove('hidden');

        const doStart = (): void => {
            document.removeEventListener('keydown', onKey);
            hideGoalsPopup();
            onOk();
        };
        const onKey = (): void => doStart();
        const btn = document.getElementById('intro-modal-ok') as HTMLButtonElement | null;
        if (btn) btn.onclick = doStart;
        document.addEventListener('keydown', onKey, { once: true });
    }

    function hideGoalsPopup(): void {
        const modal = document.getElementById('intro-modal');
        if (modal) modal.classList.add('hidden');
    }

    return { init, update, hideModal, showGoalsPopup, hideGoalsPopup, tickAutoSpawn, reset };
})();

export { UI as UIModule };