import { CONFIG } from '../config';
import { STATE, AntType } from '../state';
import { STATS } from '../stats';
import { ColonyModule } from '../colony';
import { MapModule } from '../map';
import { t, getLang, setLang, type TranslationKey } from '../i18n';
import { getDifficulty, setDifficulty, applyDifficulty, type Difficulty } from '../difficulty';

// ── Types ──────────────────────────────────────────────────────────

type AutoSpawnType = Exclude<AntType, 'queen'>;
type AutoBuildType = 'chamber' | 'expand';
type AutoActionType = 'flight';

interface MobileUICallbacks {
    setSpeed: (mult: number) => void;
    restart: () => void;
    startSurvival: () => void;
    pause: () => void;
    resume: () => void;
    centerCamera: (wx: number, wy: number) => void;
}

// ── State ──────────────────────────────────────────────────────────

let _cb: MobileUICallbacks;
let _currentSpeed = 1;
let _prevSpeed = 1;
let _onIntroStart: (() => void) | null = null;

const ELEM = {} as Record<string, HTMLElement>;

// ── DOM helpers ────────────────────────────────────────────────────

function el(id: string): HTMLElement {
    const e = document.getElementById(id);
    if (!e) throw new Error(`#${id} not found`);
    return e;
}

function setTxt(id: string, text: string | number): void {
    const e = ELEM[id] || (ELEM[id] = el(id));
    e.textContent = String(text);
}

function setStyle(id: string, prop: string, value: string): void {
    const e = ELEM[id] || (ELEM[id] = el(id));
    (e.style as any)[prop] = value;
}

function toggleClass(id: string, cls: string, on: boolean): void {
    const e = ELEM[id] || (ELEM[id] = el(id));
    e.classList.toggle(cls, on);
}

// ── Speed / Pause ──────────────────────────────────────────────────

function setSpeed(mult: number): void {
    if (mult !== 0) _prevSpeed = mult;
    _currentSpeed = mult;
    _cb.setSpeed(mult);
    updateSpeedButtons();
}

function togglePause(): void {
    setSpeed(_currentSpeed === 0 ? _prevSpeed : 0);
}

function updateSpeedButtons(): void {
    document.querySelectorAll('.speed-btn').forEach(b => {
        const btn = b as HTMLElement;
        btn.classList.toggle('active', Number(btn.dataset.speed) === _currentSpeed);
    });
}

// ── Long press helper ──────────────────────────────────────────────

function addLongPress(btn: HTMLElement, onClick: () => void, onLongPress: () => void, ms = 400): void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let triggered = false;
    let handledByTouch = false;

    btn.addEventListener('touchstart', () => {
        triggered = false;
        handledByTouch = true;
        timer = setTimeout(() => { triggered = true; onLongPress(); }, ms);
    }, { passive: true });

    btn.addEventListener('touchend', () => {
        if (timer) { clearTimeout(timer); timer = null; }
        if (!triggered) onClick();
    });

    btn.addEventListener('touchmove', () => {
        if (timer) { clearTimeout(timer); timer = null; }
    });

    btn.addEventListener('click', (e) => {
        if (handledByTouch) { handledByTouch = false; return; }
        onClick();
    });

    btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        onLongPress();
    });
}

// ── Drawer ─────────────────────────────────────────────────────────

function toggleDrawer(): void {
    const d = el('hud-drawer');
    const tb = el('drawer-toggle');
    d.classList.toggle('open');
    const isOpen = d.classList.contains('open');
    tb.textContent = isOpen ? tb.dataset.close! : tb.dataset.open!;
    tb.style.display = isOpen ? 'none' : '';
    tb.style.bottom = isOpen ? '48px' : '';
    if (isOpen) {
        el('intro-modal').classList.add('hidden');
        el('gameover-modal').classList.add('hidden');
    }
}

// ── Difficulty ─────────────────────────────────────────────────────

function changeDifficulty(d: Difficulty): void {
    setDifficulty(d);
    applyDifficulty();
    document.querySelectorAll('.diff-btn').forEach(b => {
        b.classList.toggle('active', (b as HTMLElement).dataset.diff === d);
    });
    const desc = el('difficulty-desc');
    desc.textContent = t(`diff_desc_${d}` as TranslationKey);
}

// ── Spawn click ────────────────────────────────────────────────────

function handleSpawn(type: AntType, btn: HTMLElement): void {
    if (btn.classList.contains('disabled')) return;
    ColonyModule.orderAnt(type);
}

// ── Build click ────────────────────────────────────────────────────

function handleBuildChamber(btn: HTMLElement): void {
    if (btn.classList.contains('disabled')) return;
    ColonyModule.digChamber();
}

function handleBuildExpand(btn: HTMLElement): void {
    if (btn.classList.contains('disabled')) return;
    MapModule.expandSurface();
}

// ── Create spawn buttons ───────────────────────────────────────────

const SPAWN_TYPES: { type: AutoSpawnType; dot: string; key: TranslationKey; cost: number }[] = [
    { type: 'worker', dot: '#d4a96a', key: 'btn_worker', cost: CONFIG.COST_WORKER },
    { type: 'soldier', dot: '#cc3333', key: 'btn_soldier', cost: CONFIG.COST_SOLDIER },
    { type: 'scout', dot: '#e8d44d', key: 'btn_scout', cost: CONFIG.COST_SCOUT },
    { type: 'nurse', dot: '#7ec8e3', key: 'btn_nurse', cost: CONFIG.COST_NURSE },
    { type: 'princess', dot: '#cc44cc', key: 'btn_princess', cost: CONFIG.COST_PRINCESS },
];

function createSpawnButtons(): void {
    const grid = el('spawn-grid');
    for (const { type, dot, key, cost } of SPAWN_TYPES) {
        const btn = document.createElement('button');
        btn.className = 'spawn-btn';
        btn.id = `spawn-${type}`;
        btn.innerHTML = `<span class="spawn-left"><span class="spawn-dot" style="background:${dot}"></span>${t(key)}</span><span class="spawn-right"><span class="spawn-count" id="cnt-${type}">0</span><span class="spawn-cost">${cost}</span></span>`;

        const typeCopy = type;
        addLongPress(btn,
            () => handleSpawn(typeCopy, btn),
            () => { STATE.autoSpawn[typeCopy] = !STATE.autoSpawn[typeCopy]; },
        );
        grid.appendChild(btn);
    }
}

// ── Create build buttons ───────────────────────────────────────────

function createBuildButtons(): void {
    const grid = el('build-grid');

    const chamberBtn = document.createElement('button');
    chamberBtn.className = 'build-btn';
    chamberBtn.id = 'build-chamber';
    chamberBtn.innerHTML = `<span style="display:flex;align-items:center;width:100%">${t('btn_chamber')}<span class="spawn-cost" id="chamber-cost">${CONFIG.COST_CHAMBER_BASE}</span></span><div class="build-sub" id="chamber-sub">${t('chambers_label')} 1/${CONFIG.GOAL_CHAMBERS}</div>`;
    addLongPress(chamberBtn,
        () => handleBuildChamber(chamberBtn),
        () => { STATE.autoBuild.chamber = !STATE.autoBuild.chamber; },
    );
    grid.appendChild(chamberBtn);

    const expandBtn = document.createElement('button');
    expandBtn.className = 'build-btn';
    expandBtn.id = 'build-expand';
    expandBtn.innerHTML = `<span style="display:flex;align-items:center;width:100%">${t('btn_expand')}<span class="spawn-cost" id="expand-cost">${CONFIG.SURFACE_EXPAND_COST_BASE}</span></span><div class="build-sub" id="expand-sub">${t('surface_label')} ${CONFIG.SURFACE_ROWS_START}/${CONFIG.SURFACE_ROWS_MAX}</div>`;
    addLongPress(expandBtn,
        () => handleBuildExpand(expandBtn),
        () => { STATE.autoBuild.expand = !STATE.autoBuild.expand; },
    );
    grid.appendChild(expandBtn);
}

// ── Create flight button ───────────────────────────────────────────

function createFlightButton(): void {
    const btn = el('flight-btn');
    btn.textContent = t('btn_start_flight');
    addLongPress(btn,
        () => {
            if (!btn.classList.contains('disabled')) ColonyModule.startFlight();
        },
        () => { STATE.autoAction.flight = !STATE.autoAction.flight; },
    );

    // Close drawer button
    const closeBtn = el('drawer-close');
    closeBtn.addEventListener('click', () => {
        const d = el('hud-drawer');
        const tb = el('drawer-toggle');
        d.classList.remove('open');
        tb.style.display = '';
        tb.style.bottom = '';
        tb.textContent = tb.dataset.open!;
    });
}

// ── Wire speed buttons ─────────────────────────────────────────────

function wireSpeedButtons(): void {
    document.querySelectorAll('.speed-btn').forEach(b => {
        const btn = b as HTMLElement;
        const speed = Number(btn.dataset.speed);
        btn.addEventListener('click', () => {
            if (speed === 0) { togglePause(); return; }
            setSpeed(speed);
        });
    });
}

// ── Wire drawer toggle ─────────────────────────────────────────────

function wireDrawerToggle(): void {
    const tbtn = el('drawer-toggle');
    tbtn.textContent = t('hud_spawn');
    tbtn.dataset.open = t('hud_spawn');
    tbtn.dataset.close = '✕';
    tbtn.addEventListener('click', toggleDrawer);
}

// ── UI update (called each frame) ──────────────────────────────────

export function update(): void {
    const pending = STATE.queen?.eggQueue ?? [];
    const pop = STATE.ants.length + pending.length;
    const cap = STATE.popCap();

    setTxt('food-val', Math.floor(STATE.food));
    setTxt('pop-val', `${pop}/${cap}`);
    setTxt('wave-val', `${STATE.wave} (${STATE.waveEnemyCount})`);

    const queenPct = Math.max(0, ((STATE.queen?.hp || 0) / CONFIG.QUEEN_HP) * 100);
    setStyle('queen-hp-mini-fill', 'width', queenPct + '%');

    // Spawn buttons
    const cnt = (type: AntType): number =>
        STATE.ants.filter(a => a.type === type).length + pending.filter(o => o === type).length;

    for (const { type } of SPAWN_TYPES) {
        const id = `spawn-${type}`;
        const disabled = STATE.food < (type === 'worker' ? CONFIG.COST_WORKER : type === 'soldier' ? CONFIG.COST_SOLDIER : type === 'scout' ? CONFIG.COST_SCOUT : type === 'nurse' ? CONFIG.COST_NURSE : CONFIG.COST_PRINCESS)
            || pop >= cap
            || (type === 'nurse' && !STATE.canSpawnNurse)
            || (type === 'princess' && !STATE.canSpawnPrincess);
        toggleClass(id, 'disabled', disabled);
        toggleClass(id, 'auto', STATE.autoSpawn[type]);
        setTxt(`cnt-${type}`, cnt(type));
    }

    // Build buttons
    const chamberCost = STATE.chamberCost();
    const expandCost = STATE.expandCost();
    const chamberMaxed = !STATE.canDigChamber;
    const expandMaxed = STATE.surfaceRows >= CONFIG.SURFACE_ROWS_MAX;

    toggleClass('build-chamber', 'disabled', chamberMaxed || STATE.food < chamberCost);
    toggleClass('build-chamber', 'auto', STATE.autoBuild.chamber);
    setTxt('chamber-cost', chamberMaxed ? t('cost_max') : chamberCost);
    const cSub = document.getElementById('chamber-sub');
    if (cSub) cSub.textContent = `${t('chambers_label')} ${STATE.chambers}/${CONFIG.GOAL_CHAMBERS}`;

    toggleClass('build-expand', 'disabled', expandMaxed || STATE.food < expandCost);
    toggleClass('build-expand', 'auto', STATE.autoBuild.expand);
    setTxt('expand-cost', expandMaxed ? t('cost_max') : expandCost);
    const eSub = document.getElementById('expand-sub');
    if (eSub) eSub.textContent = `${t('surface_label')} ${STATE.surfaceRows}/${CONFIG.SURFACE_ROWS_MAX}`;

    // Flight
    const princessCount = STATE.ants.filter(a => a.type === 'princess' && a.lifestage === null).length;
    toggleClass('flight-btn', 'disabled', princessCount < CONFIG.PRINCESS_LIMIT || STATE.flightStarted);
    toggleClass('flight-btn', 'auto', STATE.autoAction.flight);
    if (STATE.flightStarted) {
        setTxt('flight-btn', `${t('btn_start_flight')} ${STATE.flightEscaped}/${STATE.flightTotal}`);
    } else {
        setTxt('flight-btn', t('btn_start_flight'));
    }

    // Game over
    if (STATE.over && el('gameover-modal').classList.contains('hidden')) {
        showGameOverModal(STATE.won);
    }
}

// ── Modals ─────────────────────────────────────────────────────────

export function showIntroModal(onStart: () => void): void {
    _onIntroStart = onStart;
    const modal = el('intro-modal');
    modal.classList.remove('hidden');

    const goals = el('intro-goals');
    goals.innerHTML = `
        <li>${t('intro_goal1')}</li>
        <li>${t('intro_goal2').replace('{n}', String(CONFIG.PRINCESS_LIMIT))}</li>
        <li>${t('intro_goal3')}</li>
    `;

    const diffRow = el('diff-row');
    diffRow.innerHTML = '';
    for (const d of (['easy', 'medium', 'hard'] as Difficulty[])) {
        const btn = document.createElement('button');
        btn.className = 'diff-btn' + (d === getDifficulty() ? ' active' : '');
        btn.dataset.diff = d;
        const icons: Record<string, string> = { easy: '🌱', medium: '⚔️', hard: '💀' };
        btn.innerHTML = `<span class="diff-icon">${icons[d]}</span><span class="diff-name">${t(`diff_${d}` as TranslationKey)}</span>`;
        btn.addEventListener('click', () => changeDifficulty(d));
        diffRow.appendChild(btn);
    }

    el('difficulty-desc').textContent = t(`diff_desc_${getDifficulty()}` as TranslationKey);
    el('intro-hint').innerHTML = t('intro_hint');
    el('intro-modal-ok').textContent = t('intro_start');
}

export function hideIntroModal(): void {
    el('intro-modal').classList.add('hidden');
    _onIntroStart = null;
}

export function triggerIntroStart(): void {
    const fn = _onIntroStart;
    hideIntroModal();
    if (fn) fn();
}

function showGameOverModal(won: boolean): void {
    const modal = el('gameover-modal');
    modal.classList.remove('hidden');
    modal.classList.toggle('won', won);

    setTxt('go-title', won ? t('modal_victory_title') : t('modal_defeat_title'));
    setTxt('go-msg', won
        ? t('modal_victory_msg').replace('{wave}', String(STATE.wave))
        : t('modal_defeat_msg'));

    setTxt('go-max-ants', STATS.maxAnts);
    setTxt('go-produced', STATS.totalAntsProduced);
    setTxt('go-food', Math.floor(STATS.totalFoodCollected));
    setTxt('go-kills', STATS.totalEnemiesKilled);
    setTxt('go-princesses', STATS.totalPrincessesFled);
    setTxt('go-stars', STATE.completedFlights);

    el('btn-survival').classList.toggle('hidden', !won);
}

export function hideGameOverModal(): void {
    el('gameover-modal').classList.add('hidden');
}

// ── Init ───────────────────────────────────────────────────────────

export function init(callbacks: MobileUICallbacks): void {
    _cb = callbacks;

    createSpawnButtons();
    createBuildButtons();
    createFlightButton();
    wireSpeedButtons();
    wireDrawerToggle();

    el('intro-modal-ok').addEventListener('click', () => triggerIntroStart());

    el('btn-restart').addEventListener('click', () => {
        hideGameOverModal();
        _cb.restart();
    });

    el('btn-survival').addEventListener('click', () => {
        hideGameOverModal();
        _cb.startSurvival();
    });

    // Language button
    const langBtn = el('lang-btn');
    const updateLangBtn = (): void => {
        langBtn.textContent = getLang() === 'en' ? 'EN' : 'RU';
    };
    updateLangBtn();
    langBtn.addEventListener('click', () => {
        setLang(getLang() === 'en' ? 'ru' : 'en');
        updateLangBtn();
        // Rebuild dynamic content
        wireDrawerToggle();
    });
}

// ── Exports for mobile-main ────────────────────────────────────────

export { setSpeed, togglePause, _currentSpeed as getCurrentSpeed };
