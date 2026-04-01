import {
    Application, BufferImageSource, Container,
    Sprite, Texture,
} from 'pixi.js';
import { AntType } from '../state';
import { MAP_W, MAP_H, ANT_W, ANT_H, ANT_CX, ANT_CY, ANT_AY, ENM_SZ, EGG_W, EGG_H, LAR_W, LAR_H, PUP_W, PUP_H, FOOD_SZ, FOOD_CX, FOOD_CY, NEST_SZ, CARRY_FOOD_SZ, CARRY_EGG_W, CARRY_EGG_H, WING_FRAMES, WING_W, WING_H, WING_CX, WING_CY } from './constants';
import { buildAnt, buildBeetle, buildSpider, buildEgg, buildLarva, buildPupa, buildFoodPellet, buildNestMarker, buildCarryFood, buildCarryEgg, buildWingFrame, bakeTexture } from './builders';
import { initMap, updateMap } from './map';
import { initEntities, updateEntities } from './entities';
import { createFoodContainer, initFood, createOverlayContainer, initOverlay, updateFood, updateOverlay } from './overlay';
import { IntroQueenData, createIntroLayers, setIntroQueen as _setIntroQueen, hasIntroData, updateIntroQueen } from './intro';

export type { IntroQueenData };

let _app: Application;

export const Renderer = {
    async init(canvas: HTMLCanvasElement): Promise<void> {
        _app = new Application();
        await _app.init({
            canvas: canvas as unknown as HTMLCanvasElement,
            width: MAP_W,
            height: MAP_H,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            backgroundColor: 0x000000,
            autoStart: false,   // we drive the render loop ourselves
        } as Parameters<Application['init']>[0]);

        // ── Map layer ─────────────────────────────────────────────────────────────
        const mapPixels = new Uint8Array(MAP_W * MAP_H * 4);
        const mapBuf32 = new Uint32Array(mapPixels.buffer);
        const mapSrc = new BufferImageSource({ resource: mapPixels, width: MAP_W, height: MAP_H });
        const mapSprite = new Sprite(new Texture({ source: mapSrc }));
        _app.stage.addChild(mapSprite);
        initMap(mapBuf32, mapSrc);

        // ── Food sprite layer ─────────────────────────────────────────────────────
        const foodContainer = createFoodContainer();
        _app.stage.addChild(foodContainer);

        // ── Entity layer ──────────────────────────────────────────────────────────
        const entities = new Container();
        const stagesLayer = new Container();   // below ants
        const prWingLayer = new Container();   // princess wings
        const adultsLayer = new Container();   // above stages
        entities.addChild(stagesLayer);
        entities.addChild(adultsLayer);
        entities.addChild(prWingLayer);
        _app.stage.addChild(entities);

        // ── Overlay sprite layer (HP bars, carried items, nest ring) ──────────────
        const overlayContainer = createOverlayContainer();
        _app.stage.addChild(overlayContainer);

        // ── Pre-bake textures ─────────────────────────────────────────────────────
        initFood(bakeTexture(_app, buildFoodPellet(), FOOD_SZ, FOOD_SZ, FOOD_CX, FOOD_CY));
        initOverlay(
            bakeTexture(_app, buildNestMarker(),  NEST_SZ,     NEST_SZ,     NEST_SZ / 2,     NEST_SZ / 2),
            bakeTexture(_app, buildCarryFood(),   CARRY_FOOD_SZ, CARRY_FOOD_SZ, CARRY_FOOD_SZ / 2, CARRY_FOOD_SZ / 2),
            bakeTexture(_app, buildCarryEgg(),    CARRY_EGG_W, CARRY_EGG_H, CARRY_EGG_W / 2, CARRY_EGG_H / 2),
        );

        // ── Pre-bake all textures (3 animation frames per ant type) ──────────────
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

        const wingTextures: Texture[] = [];
        for (let i = 0; i < WING_FRAMES; i++) {
            const f = 0.55 + 0.45 * (i / (WING_FRAMES - 1));
            wingTextures.push(bakeTexture(_app, buildWingFrame(f), WING_W, WING_H, WING_CX, WING_CY));
        }

        initEntities(adultsLayer, stagesLayer, prWingLayer, antTex, enmTex, eggTex, larvaTex, pupaTex, wingTextures);

        // ── Intro animation layer (above overlay) ─────────────────────────────────
        const { fallenWingsG, wingsG, queenSpr } = createIntroLayers(antTex.get('queen_1')!);
        _app.stage.addChild(fallenWingsG);   // shed wings lying on ground
        _app.stage.addChild(queenSpr);
        _app.stage.addChild(wingsG);         // wings on top of queen
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

    setIntroQueen(data: IntroQueenData | null): void {
        _setIntroQueen(data);
    },

    destroy(): void {
        _app?.destroy(false);
    },
};
