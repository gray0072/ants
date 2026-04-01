import { Container, Sprite, Texture } from 'pixi.js';
import { STATE, AntType } from '../state';
import { CELL, DISP, ANT_AY, ANT_HEX, WING_CX, WING_W, WING_CY, WING_H } from './constants';

let _adultsLayer: Container;
let _stagesLayer: Container;
let _prWingLayer: Container;

// Flat array: _antTexFlat[typeIdx * 3 + frame] — avoids Map lookup + string concat per ant per frame
const _ANT_TYPE_IDX: Record<AntType, number> = { worker: 0, soldier: 1, scout: 2, queen: 3, nurse: 4, princess: 5 };
let _antTexFlat: Texture[];
let _wingTexFlat: Texture[];
let _enmTex: Map<string, Texture>;
let _eggTex: Texture;
let _larvaTex: Texture;
let _pupaTex: Texture;

const _antPool: Sprite[] = [];
const _stagePool: Sprite[] = [];
const _enmPool: Sprite[] = [];
const _prWingPool: Sprite[] = [];

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
    wingTextures: Texture[],
): void {
    _adultsLayer = adultsLayer;
    _stagesLayer = stagesLayer;
    _prWingLayer = prWingLayer;
    _antTexFlat = new Array(6 * 3).fill(Texture.EMPTY);
    for (const [key, tex] of antTex) {
        const under = key.lastIndexOf('_');
        const type = key.slice(0, under) as AntType;
        const frame = +key.slice(under + 1);
        _antTexFlat[_ANT_TYPE_IDX[type] * 3 + frame] = tex;
    }
    _wingTexFlat = wingTextures;
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
        const isDev = ant.lifestage === 'egg' || ant.lifestage === 'larva' || ant.lifestage === 'pupa';
        if (isDev) {
            const s = stageSprite(si++);
            s.visible = true;
            s.position.set(ant.col * CELL, ant.row * CELL);
            s.rotation = 0;
            if (ant.lifestage === 'egg') {
                s.texture = _eggTex;
                s.tint = ANT_HEX[ant.type as AntType] ?? 0xffffff;
            } else if (ant.lifestage === 'larva') {
                s.texture = _larvaTex;
                s.tint = 0xffffff;
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
            s.texture = _antTexFlat[_ANT_TYPE_IDX[ant.type] * 3 + animFrame];
            s.rotation = (ant.angle ?? -Math.PI / 2) + Math.PI / 2;
        }
    }
    for (let i = si; i < _stagePool.length; i++) _stagePool[i].visible = false;
    for (let i = ai; i < _antPool.length; i++) _antPool[i].visible = false;

    // Princess FLIGHT wings — baked sprite frames replace dynamic Graphics.
    // All visible princesses share the same animation frame (same _animTick).
    const wf = 0.55 + 0.45 * Math.abs(Math.sin(_animTick * 1.31));
    const wfi = Math.min(_wingTexFlat.length - 1,
        Math.round((wf - 0.55) / 0.45 * (_wingTexFlat.length - 1)));
    let wi = 0;
    for (const ant of STATE.ants) {
        if (ant.type !== 'princess' || ant.state !== 'fly') continue;
        if (wi >= _prWingPool.length) {
            const s = new Sprite(Texture.EMPTY);
            s.anchor.set(WING_CX / WING_W, WING_CY / WING_H);
            s.scale.set(DISP);
            _prWingLayer.addChild(s);
            _prWingPool.push(s);
        }
        const s = _prWingPool[wi++];
        s.visible = true;
        s.texture = _wingTexFlat[wfi];
        s.position.set(ant.col * CELL, ant.row * CELL);
        s.rotation = (ant.angle ?? -Math.PI / 2) + Math.PI / 2;
    }
    for (let i = wi; i < _prWingPool.length; i++) _prWingPool[i].visible = false;

    // Enemies
    let ei = 0;
    for (const e of STATE.enemies) {
        const col = Math.floor(e.col), row = Math.floor(e.row);
        if (fog[STATE.idx(col, row)] <= 0) continue;

        const s = enmSprite(ei++);
        s.visible = true;
        s.position.set(e.col * CELL, e.row * CELL);
        s.texture = _enmTex.get(e.type) ?? Texture.EMPTY;
        s.rotation = (e.angle ?? Math.PI / 2) + Math.PI / 2;
        s.tint = 0xffffff;
    }
    for (let i = ei; i < _enmPool.length; i++) _enmPool[i].visible = false;
}
