export type Lang = 'en' | 'ru';

const STORAGE_KEY = 'ant_colony_lang';

export const TRANSLATIONS = {
    en: {
        doc_title: 'Ant Colony',
        title: '🐜 Ant Colony',
        enemies: 'enemies',
        hud_food: 'Food',
        hud_pop: 'Population',
        hud_wave: 'Wave',
        hud_queen_hp: 'Queen HP',
        hud_egg_queue: 'Egg Queue',
        hud_spawn: 'Spawn',
        hud_build: 'Build',
        hud_legend: 'Legend',
        hud_speed: 'Speed',
        hud_goals: 'Goals',
        btn_worker: 'Worker',
        btn_soldier: 'Soldier',
        btn_scout: 'Scout',
        btn_nurse: 'Nurse',
        btn_princess: 'Princess',
        btn_chamber: 'Dig Chamber',
        btn_expand: 'Expand Surface',
        chambers_label: 'Chambers:',
        surface_label: 'Surface:',
        leg_queen: 'Queen',
        leg_princess: 'Princess',
        leg_worker: 'Worker',
        leg_soldier: 'Soldier',
        leg_scout: 'Scout',
        leg_nurse: 'Nurse',
        leg_beetle: 'Beetle',
        leg_spider: 'Spider',
        leg_food: 'Food / Trail',
        goal_queen: 'Save the Queen',
        goal_chambers: 'Dig 25 chambers',
        goal_surface: 'Expand full surface',
        goal_princesses: 'Raise {n} princesses',
        goal_flight: 'Start the flight',
        btn_start_flight: 'Start Flight',
        diff_easy: 'Easy',
        diff_medium: 'Medium',
        diff_hard: 'Hard',
        diff_desc_easy: '300 food · 20 princesses · ~9 enemies at wave 50',
        diff_desc_medium: '200 food · 25 princesses · ~14 enemies at wave 50',
        diff_desc_hard: '120 food · 30 princesses · ~22 enemies at wave 50',
        intro_goal1: 'Dig <strong>25 chambers</strong> underground',
        intro_goal2: 'Raise <strong>{n} princesses</strong>',
        intro_goal3: 'Launch the <strong>princess flight</strong>',
        intro_hint: 'W/S/E/D — spawn ants &nbsp;·&nbsp; R — dig chamber &nbsp;·&nbsp; F — expand surface',
        intro_hint_shift: 'Shift+click any button to toggle auto-mode',
        intro_start: 'Start',
        intro_skip: 'Space / Enter to start',
        modal_restart: 'Restart',
        modal_survival: 'Continue (Survival)',
        modal_defeat_title: 'Defeat',
        modal_defeat_msg: 'Your queen has fallen. But every colony teaches a lesson.',
        stats_max_ants: 'Peak population',
        stats_produced: 'Ants raised',
        stats_food: 'Food gathered',
        stats_kills: 'Enemies defeated',
        stats_princesses: 'Princesses flown',
        stats_stars: 'Flights completed',
        modal_victory_title: 'Victory!',
        modal_victory_msg: 'The princesses have flown! Your colony will live on.',
        cost_max: 'MAX',
    },
    ru: {
        doc_title: 'Муравейник',
        title: '🐜 Муравейник',
        enemies: 'врагов',
        hud_food: 'Еда',
        hud_pop: 'Население',
        hud_wave: 'Волна',
        hud_queen_hp: 'HP матки',
        hud_egg_queue: 'Очередь яиц',
        hud_spawn: 'Спавн',
        hud_build: 'Строить',
        hud_legend: 'Легенда',
        hud_speed: 'Скорость',
        hud_goals: 'Цели',
        btn_worker: 'Рабочий',
        btn_soldier: 'Солдат',
        btn_scout: 'Разведчик',
        btn_nurse: 'Нянька',
        btn_princess: 'Принцесса',
        btn_chamber: 'Рыть камеру',
        btn_expand: 'Расш. поверх.',
        chambers_label: 'Камеры:',
        surface_label: 'Поверх.:',
        leg_queen: 'Матка',
        leg_princess: 'Принцесса',
        leg_worker: 'Рабочий',
        leg_soldier: 'Солдат',
        leg_scout: 'Разведчик',
        leg_nurse: 'Нянька',
        leg_beetle: 'Жук',
        leg_spider: 'Паук',
        leg_food: 'Еда / след',
        goal_queen: 'Сохранить матку',
        goal_chambers: 'Выкопать 25 камер',
        goal_surface: 'Открыть всю поверхность',
        goal_princesses: 'Вырастить {n} принцесс',
        goal_flight: 'Начать лёт принцесс',
        btn_start_flight: 'Начать лёт',
        diff_easy: 'Легко',
        diff_medium: 'Средне',
        diff_hard: 'Сложно',
        diff_desc_easy: '300 еды · 20 принцесс · ~9 врагов на волне 50',
        diff_desc_medium: '200 еды · 25 принцесс · ~14 врагов на волне 50',
        diff_desc_hard: '120 еды · 30 принцесс · ~22 врагов на волне 50',
        intro_goal1: 'Выкопай <strong>25 камер</strong> под землёй',
        intro_goal2: 'Вырасти <strong>{n} принцесс</strong>',
        intro_goal3: 'Запусти <strong>лёт принцесс</strong>',
        intro_hint: 'W/S/E/D — спавн &nbsp;·&nbsp; R — рыть камеру &nbsp;·&nbsp; F — расш. пов.',
        intro_hint_shift: 'Shift+клик по кнопке — авторежим',
        intro_start: 'Начать',
        intro_skip: 'Пробел / Enter для старта',
        modal_restart: 'Заново',
        modal_survival: 'Продолжить (выживание)',
        modal_defeat_title: 'Поражение',
        modal_defeat_msg: 'Матка пала. Но каждая колония — это опыт.',
        stats_max_ants: 'Пик населения',
        stats_produced: 'Муравьёв выращено',
        stats_food: 'Еды собрано',
        stats_kills: 'Врагов уничтожено',
        stats_princesses: 'Принцесс улетело',
        stats_stars: 'Лётов завершено',
        modal_victory_title: 'Победа!',
        modal_victory_msg: 'Принцессы улетели! Ваша колония продолжит жить.',
        cost_max: 'МАКС',
    },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.en;

const stored = localStorage.getItem(STORAGE_KEY);
let currentLang: Lang = (stored === 'en' || stored === 'ru') ? stored : 'en';

export function getLang(): Lang {
    return currentLang;
}

export function setLang(lang: Lang): void {
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
}

export function t(key: TranslationKey): string {
    return TRANSLATIONS[currentLang][key] as string;
}

export function applyTranslations(): void {
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n as TranslationKey);
    });
    document.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach(el => {
        el.innerHTML = t(el.dataset.i18nHtml as TranslationKey);
    });
    document.title = t('doc_title');
    document.documentElement.lang = currentLang;
}
