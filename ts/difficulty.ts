import { CONFIG } from './config';

export type Difficulty = 'easy' | 'medium' | 'hard';

const STORAGE_KEY = 'ant_colony_difficulty';

export interface DifficultyPreset {
    startFood: number;
    princessLimit: number;
    enemyWaveScale: number;
}

export const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyPreset> = {
    easy:   { startFood: 300, princessLimit: 20, enemyWaveScale: 1.03 },
    medium: { startFood: 200, princessLimit: 25, enemyWaveScale: 1.04 },
    hard:   { startFood: 120, princessLimit: 30, enemyWaveScale: 1.05 },
};

const stored = localStorage.getItem(STORAGE_KEY);
let current: Difficulty = (stored === 'easy' || stored === 'medium' || stored === 'hard') ? stored : 'easy';

export function getDifficulty(): Difficulty { return current; }

export function setDifficulty(d: Difficulty): void {
    current = d;
    localStorage.setItem(STORAGE_KEY, d);
}

export function applyDifficulty(): void {
    const p = DIFFICULTY_PRESETS[current];
    CONFIG.START_FOOD = p.startFood;
    CONFIG.PRINCESS_LIMIT = p.princessLimit;
    CONFIG.ENEMY_WAVE_SCALE = p.enemyWaveScale;
}
