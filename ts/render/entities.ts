import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { STATE, AntType } from '../state';
import { CELL, DISP, ANT_AY, ANT_HEX } from './constants';

interface PrWingEntry { container: Container; g: Graphics; }

let _adultsLayer: Container;
let _stagesLayer: Container;
let _prWingLayer: Container;

let _antTex: Map<string, Texture>;
let _enmTex: Map<string, Texture>;
let _eggTex: Texture;
let _larvaTex: Texture;
let _pupaTex: Texture;

const _antPool: Sprite[] = [];
const _stagePool: Sprite[] = [];
const _enmPool: Sprite[] = [];
const _prWingPool: PrWingEntry[] = [];

let _animTick = 0;

export function initEntities(
    adultsLayer: Container,
    stagesLayer: Container,
    prWingLayer: Container,
    antTex: Map<string, Texture>,
    enmTex: Map<string, Texture>,
    eggTex: Texture,
    larvaTex: Texture,
    pupaTex: Texture,
): void {
    _adultsLayer = adultsLayer;
    _stagesLayer = stagesLayer;
    _prWingLayer = prWingLayer;
    _antTex = antTex;
    _enmTex = enmTex;
    _eggTex = eggTex;
    _larvaTex = larvaTex;
    _pupaTex = pupaTex;
}

function antSprite(idx: number): Sprite {
    if (idx >= _antPool.length) {
        const s = new Sprite(Texture.EMPTY);
        s.anchor.set(0.5, ANT_AY);
        s.scale.set(DISP);
        _adultsLayer.addChild(s);
        _antPool.push(s);
    }
    return _antPool[idx];
}

function stageSprite(idx: number): Sprite {
    if (idx >= _stagePool.length) {
        const s = new Sprite(Texture.EMPTY);
        s.anchor.set(0.5, 0.5);
        s.scale.set(DISP);
        _stagesLayer.addChild(s);
        _stagePool.push(s);
    }
    return _stagePool[idx];
}

function enmSprite(idx: number): Sprite {
    if (idx >= _enmPool.length) {
        const s = new Sprite(Texture.EMPTY);
        s.anchor.set(0.5, 0.5);
        s.scale.set(DISP);
        _adultsLayer.addChild(s);
        _enmPool.push(s);
    }
    return _enmPool[idx];
}

export function updateEntities(): void {
    _animTick++;
    const fog = STATE.fog;
    let ai = 0;
    let si = 0;

    for (const ant of STATE.ants) {
        if (ant._carried) continue;
        const col = Math.round(ant.col), row = Math.round(ant.row);
        // Airborne princesses may be above the map — still render them
        const isPrincessAirborne = ant.type === 'princess' && ant.state === 'fly';
        if (!isPrincessAirborne && fog && STATE.inBounds(col, row) && fog[STATE.idx(col, row)] <= 0) continue;

        const isDev = ant.lifestage === 'egg' || ant.lifestage === 'larva' || ant.lifestage === 'pupa';
        if (isDev) {
            const s = stageSprite(si++);
            s.visible = true;
            s.position.set(ant.col * CELL, ant.row * CELL);
            s.tint = 0xffffff;
            s.rotation = 0;
            if (ant.lifestage === 'egg') {
                s.texture = _eggTex;
                s.tint = ANT_HEX[ant.type as AntType] ?? 0xffffff;
            } else if (ant.lifestage === 'larva') {
                s.texture = _larvaTex;
            } else {
                s.texture = _pupaTex;
                s.tint = ANT_HEX[ant.type as AntType] ?? 0xffffff;
            }
        } else {
            const s = antSprite(ai++);
            s.visible = true;
            s.position.set(ant.col * CELL, ant.row * CELL);
            s.tint = 0xffffff;
            const animFrame = Math.floor((_animTick / 5 + ai * 13) % 3);
            s.texture = _antTex.get(`${ant.type}_${animFrame}`) ?? Texture.EMPTY;
            s.anchor.set(0.5, ANT_AY);
            s.rotation = (ant.angle ?? -Math.PI / 2) + Math.PI / 2;
        }
    }
    for (let i = si; i < _stagePool.length; i++) _stagePool[i].visible = false;
    for (let i = ai; i < _antPool.length; i++) _antPool[i].visible = false;

    // Princess FLIGHT wings — only shown when not in 'wander' (ground) state.
    // While walking the folded wings are baked into the sprite; this layer is reserved for flight.
    let wi = 0;
    for (const ant of STATE.ants) {
        if (ant.type !== 'princess' || ant.lifestage || ant.state !== 'fly') continue;
        const col = Math.round(ant.col), row = Math.round(ant.row);
        // Always render airborne princesses even if out of bounds; apply fog only when in bounds
        const inBounds = STATE.inBounds(col, row);
        if (inBounds && fog && fog[STATE.idx(col, row)] <= 0) continue;

        if (wi >= _prWingPool.length) {
            const container = new Container();
            const g = new Graphics();
            container.addChild(g);
            _prWingLayer.addChild(container);
            _prWingPool.push({ container, g });
        }
        const { container, g } = _prWingPool[wi++];
        container.visible = true;
        container.position.set(ant.col * CELL, ant.row * CELL);
        container.rotation = (ant.angle ?? -Math.PI / 2) + Math.PI / 2;

        g.clear();
        const r = CELL * 0.55 * 1.25;
        const ty = -r * 0.43;
        const f = 0.55 + 0.45 * Math.abs(Math.sin(_animTick * 1.31));

        g.ellipse(-r * 1.3, ty - r * 0.1, r * 1.9 * f, r * 0.5 * f).fill({ color: 0xd0e8ff, alpha: 0.65 });
        g.ellipse(r * 1.3, ty - r * 0.1, r * 1.9 * f, r * 0.5 * f).fill({ color: 0xd0e8ff, alpha: 0.65 });
        g.ellipse(-r * 1.0, ty + r * 0.5, r * 1.4 * f, r * 0.38 * f).fill({ color: 0xb8d4ff, alpha: 0.55 });
        g.ellipse(r * 1.0, ty + r * 0.5, r * 1.4 * f, r * 0.38 * f).fill({ color: 0xb8d4ff, alpha: 0.55 });
    }
    for (let i = wi; i < _prWingPool.length; i++) _prWingPool[i].container.visible = false;

    // Enemies
    let ei = 0;
    for (const e of STATE.enemies) {
        const col = Math.floor(e.col), row = Math.floor(e.row);
        if (fog && STATE.inBounds(col, row) && fog[STATE.idx(col, row)] <= 0) continue;

        const s = enmSprite(ei++);
        s.visible = true;
        s.position.set(e.col * CELL, e.row * CELL);
        s.texture = _enmTex.get(e.type) ?? Texture.EMPTY;
        s.rotation = (e.angle ?? Math.PI / 2) + Math.PI / 2;
        s.tint = 0xffffff;
    }
    for (let i = ei; i < _enmPool.length; i++) _enmPool[i].visible = false;
}
