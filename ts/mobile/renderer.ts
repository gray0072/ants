import {
    Application, BufferImageSource, Container,
    Sprite, Texture,
} from 'pixi.js';
import { CONFIG } from '../config';
import { AntType } from '../state';
import { MAP_W, MAP_H, ANT_W, ANT_H, ANT_CX, ANT_CY, ENM_SZ, EGG_W, EGG_H, LAR_W, LAR_H, PUP_W, PUP_H, FOOD_SZ, FOOD_CX, FOOD_CY, NEST_SZ, CARRY_FOOD_SZ, CARRY_EGG_W, CARRY_EGG_H } from '../render/constants';
import { buildAnt, buildBeetle, buildSpider, buildEgg, buildLarva, buildPupa, buildFoodPellet, buildNestMarker, buildCarryFood, buildCarryEgg, bakeTexture } from '../render/builders';
import { initMap, updateMap } from '../render/map';
import { initEntities, updateEntities } from '../render/entities';
import { createFoodContainer, initFood, createOverlayContainer, initOverlay, updateFood, updateOverlay } from '../render/overlay';
import { IntroQueenData, createIntroLayers, setIntroQueen as _setIntroQueen, hasIntroData, updateIntroQueen } from '../render/intro';
import type { TouchCamera } from './touch';

export type { IntroQueenData };

let _app: Application;
let _viewport: Container;

export const MobileRenderer = {
    async init(canvas: HTMLCanvasElement, width: number, height: number): Promise<void> {
        _app = new Application();
        await _app.init({
            canvas: canvas as unknown as HTMLCanvasElement,
            width: MAP_W,
            height: MAP_H,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            backgroundColor: 0x000000,
            autoStart: false,
        } as Parameters<Application['init']>[0]);

        // Viewport container — all game layers are children of this.
        // Panning is done by moving this container.
        _viewport = new Container();
        _app.stage.addChild(_viewport);

        // Map layer
        const mapPixels = new Uint8Array(MAP_W * MAP_H * 4);
        const mapBuf32 = new Uint32Array(mapPixels.buffer);
        const mapSrc = new BufferImageSource({ resource: mapPixels, width: MAP_W, height: MAP_H });
        const mapSprite = new Sprite(new Texture({ source: mapSrc }));
        _viewport.addChild(mapSprite);
        initMap(mapBuf32, mapSrc);

        // Food sprite layer
        const foodContainer = createFoodContainer();
        _viewport.addChild(foodContainer);

        // Entity layer
        const entities = new Container();
        const stagesLayer = new Container();
        const prWingLayer = new Container();
        const adultsLayer = new Container();
        entities.addChild(stagesLayer);
        entities.addChild(adultsLayer);
        entities.addChild(prWingLayer);
        _viewport.addChild(entities);

        // Overlay layer
        const overlayContainer = createOverlayContainer();
        _viewport.addChild(overlayContainer);

        // Bake textures
        initFood(bakeTexture(_app, buildFoodPellet(), FOOD_SZ, FOOD_SZ, FOOD_CX, FOOD_CY));
        initOverlay(
            bakeTexture(_app, buildNestMarker(), NEST_SZ, NEST_SZ, NEST_SZ / 2, NEST_SZ / 2),
            bakeTexture(_app, buildCarryFood(), CARRY_FOOD_SZ, CARRY_FOOD_SZ, CARRY_FOOD_SZ / 2, CARRY_FOOD_SZ / 2),
            bakeTexture(_app, buildCarryEgg(), CARRY_EGG_W, CARRY_EGG_H, CARRY_EGG_W / 2, CARRY_EGG_H / 2),
        );

        // Bake ant textures
        const antTex = new Map<string, Texture>();
        for (const type of ['worker', 'soldier', 'scout', 'queen', 'nurse', 'princess'] as AntType[]) {
            for (const frame of [0, 1, 2]) {
                antTex.set(`${type}_${frame}`, bakeTexture(_app, buildAnt(type, frame), ANT_W, ANT_H, ANT_CX, ANT_CY));
            }
        }
        const enmTex = new Map<string, Texture>();
        enmTex.set('beetle', bakeTexture(_app, buildBeetle(), ENM_SZ, ENM_SZ, ENM_SZ / 2, ENM_SZ / 2));
        enmTex.set('spider', bakeTexture(_app, buildSpider(), ENM_SZ, ENM_SZ, ENM_SZ / 2, ENM_SZ / 2));
        const eggTex = bakeTexture(_app, buildEgg(), EGG_W, EGG_H, EGG_W / 2, EGG_H / 2);
        const larvaTex = bakeTexture(_app, buildLarva(), LAR_W, LAR_H, LAR_W / 2, LAR_H / 2);
        const pupaTex = bakeTexture(_app, buildPupa(), PUP_W, PUP_H, PUP_W / 2, PUP_H / 2);

        initEntities(adultsLayer, stagesLayer, prWingLayer, antTex, enmTex, eggTex, larvaTex, pupaTex);

        // Intro layer
        const { fallenWingsG, wingsG, queenSpr } = createIntroLayers(antTex.get('queen_1')!);
        _viewport.addChild(fallenWingsG);
        _viewport.addChild(queenSpr);
        _viewport.addChild(wingsG);
    },

    render(): void {
        if (!_app) return;
        updateMap();
        updateFood();
        updateEntities();
        updateOverlay();
        if (hasIntroData()) updateIntroQueen();
        _app.renderer.render(_app.stage);
    },

    setCamera(cam: TouchCamera): void {
        _viewport.x = -cam.x;
        _viewport.y = -cam.y;
    },

    setIntroQueen(data: IntroQueenData | null): void {
        _setIntroQueen(data);
    },

    destroy(): void {
        _app?.destroy(false);
    },
};
