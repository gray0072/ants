import { Container, Sprite, Texture } from 'pixi.js';
import { CONFIG } from '../config';
import { STATE, AntType } from '../state';
import { CELL, DISP, ANT_HEX, FOOD_BASE_R, CARRY_FOOD_BASE_R } from './constants';

// ── Food layer ────────────────────────────────────────────────────────────────

let _foodContainer: Container;
let _foodTex: Texture;
const _foodPool: Sprite[] = [];

export function createFoodContainer(): Container {
    _foodContainer = new Container();
    return _foodContainer;
}

export function initFood(tex: Texture): void {
    _foodTex = tex;
}

function foodSprite(idx: number): Sprite {
    if (idx >= _foodPool.length) {
        const s = new Sprite(_foodTex);
        s.anchor.set(0.5);
        _foodContainer.addChild(s);
        _foodPool.push(s);
    }
    return _foodPool[idx];
}

export function updateFood(): void {
    const { COLS, FOOD_MAX } = CONFIG;
    const food = STATE.foodGrid;
    const fog = STATE.fog;
    let si = 0;

    for (const i of STATE.foodCells) {
        const fv = food[i];
        if (fv <= 0) continue;
        const fogV = fog ? fog[i] : 1;
        if (fogV <= 0) continue;

        const col = i % COLS;
        const row = (i / COLS) | 0;
        const t = Math.sqrt(Math.min(1, fv / FOOD_MAX));
        const fa = Math.min(1, fogV * 2);
        const h = (col * 1234 ^ row * 5678) & 0xff;
        const ox = ((h & 0x0f) - 7.5) / 7.5 * CELL * 0.14;
        const oy = ((h >> 4) - 7.5) / 7.5 * CELL * 0.14;

        const s = foodSprite(si++);
        s.x = col * CELL + CELL * 0.5 + ox;
        s.y = row * CELL + CELL * 0.5 + oy;
        s.scale.set(DISP * (0.14 + t * 0.30) / FOOD_BASE_R);
        s.alpha = fa;
        s.visible = true;
    }

    for (let i = si; i < _foodPool.length; i++) _foodPool[i].visible = false;
}

// ── Overlay layer ─────────────────────────────────────────────────────────────

let _container: Container;
let _nestSpr: Sprite;
let _carryFoodTex: Texture;
let _carryEggTex: Texture;
const _carryFoodPool: Sprite[] = [];
const _carryEggPool: Sprite[] = [];
const _hpBgPool: Sprite[] = [];
const _hpFgPool: Sprite[] = [];

export function createOverlayContainer(): Container {
    _container = new Container();
    return _container;
}

export function initOverlay(nestTex: Texture, carryFoodTex: Texture, carryEggTex: Texture): void {
    _carryFoodTex = carryFoodTex;
    _carryEggTex = carryEggTex;
    _nestSpr = new Sprite(nestTex);
    _nestSpr.anchor.set(0.5);
    _nestSpr.scale.set(DISP);
    _container.addChild(_nestSpr);
}

function carryFoodSprite(idx: number): Sprite {
    if (idx >= _carryFoodPool.length) {
        const s = new Sprite(_carryFoodTex);
        s.anchor.set(0.5);
        _container.addChild(s);
        _carryFoodPool.push(s);
    }
    return _carryFoodPool[idx];
}

function carryEggSprite(idx: number): Sprite {
    if (idx >= _carryEggPool.length) {
        const s = new Sprite(_carryEggTex);
        s.anchor.set(0.5);
        _container.addChild(s);
        _carryEggPool.push(s);
    }
    return _carryEggPool[idx];
}

function hpBgSprite(idx: number): Sprite {
    if (idx >= _hpBgPool.length) {
        const s = new Sprite(Texture.WHITE);
        s.tint = 0x550000;
        _container.addChild(s);
        _hpBgPool.push(s);
    }
    return _hpBgPool[idx];
}

function hpFgSprite(idx: number): Sprite {
    if (idx >= _hpFgPool.length) {
        const s = new Sprite(Texture.WHITE);
        _container.addChild(s);
        _hpFgPool.push(s);
    }
    return _hpFgPool[idx];
}

export function updateOverlay(): void {
    const fog = STATE.fog;
    let cfi = 0;   // carry-food index
    let cei = 0;   // carry-egg index
    let hpi = 0;   // hp-bar index

    // Nest marker
    _nestSpr.x = STATE.nestCol * CELL + CELL / 2;
    _nestSpr.y = STATE.nestRow * CELL + CELL / 2;

    // Carried items
    for (const ant of STATE.ants) {
        if (ant._carried || ant.lifestage) continue;
        if (!(ant.type === 'worker' && ant.carriedFood) && !(ant.type === 'nurse' && ant.carriedEgg)) continue;

        const r = CELL * 0.38;
        const θ = (ant.angle ?? -Math.PI / 2) + Math.PI / 2;
        const sinθ = Math.sin(θ), cosθ = Math.cos(θ);

        if (ant.type === 'worker' && ant.carriedFood > 0) {
            const s = carryFoodSprite(cfi++);
            s.x = r * 1.42 * sinθ + ant.col * CELL;
            s.y = -r * 1.42 * cosθ + ant.row * CELL;
            s.scale.set(DISP * r / (CELL * CARRY_FOOD_BASE_R));
            s.visible = true;
        }
        if (ant.type === 'nurse' && ant.carriedEgg) {
            const s = carryEggSprite(cei++);
            s.x = r * 1.55 * sinθ + ant.col * CELL;
            s.y = -r * 1.55 * cosθ + ant.row * CELL;
            s.tint = ANT_HEX[ant.carriedEgg.type as AntType] ?? 0xffffff;
            s.scale.set(DISP);
            s.visible = true;
        }
    }

    // HP bars — ants
    for (const ant of STATE.ants) {
        if (ant._carried || ant.hp >= ant.maxHp) continue;
        const r = (ant.type === 'queen' || ant.type === 'princess') ? CELL * 0.55 : CELL * 0.38;
        const bw = CELL * 1.2, bh = 2;
        const bx = ant.col * CELL - bw / 2, by = ant.row * CELL - r - 6;
        const bg = hpBgSprite(hpi); bg.x = bx; bg.y = by; bg.scale.set(bw, bh); bg.visible = true;
        const fg = hpFgSprite(hpi++); fg.x = bx; fg.y = by;
        fg.scale.set(bw * (ant.hp / ant.maxHp), bh); fg.tint = 0x00ee00; fg.visible = true;
    }

    // HP bars — enemies
    for (const e of STATE.enemies) {
        if (e.hp >= e.maxHp) continue;
        const col = Math.floor(e.col), row = Math.floor(e.row);
        if (STATE.inBounds(col, row) && fog[STATE.idx(col, row)] <= 0) continue;
        const r = CELL * 0.45;
        const bw = CELL * 1.2, bh = 2;
        const bx = e.col * CELL - bw / 2, by = e.row * CELL - r - 5;
        const bg = hpBgSprite(hpi); bg.x = bx; bg.y = by; bg.scale.set(bw, bh); bg.visible = true;
        const fg = hpFgSprite(hpi++); fg.x = bx; fg.y = by;
        fg.scale.set(bw * (e.hp / e.maxHp), bh); fg.tint = 0xff5500; fg.visible = true;
    }

    // Hide unused sprites
    for (let i = cfi; i < _carryFoodPool.length; i++) _carryFoodPool[i].visible = false;
    for (let i = cei; i < _carryEggPool.length; i++)  _carryEggPool[i].visible = false;
    for (let i = hpi; i < _hpBgPool.length; i++)      _hpBgPool[i].visible = false;
    for (let i = hpi; i < _hpFgPool.length; i++)      _hpFgPool[i].visible = false;
}
