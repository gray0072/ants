import { Graphics, Sprite, Texture } from 'pixi.js';
import { CELL, DISP, ANT_AY } from './constants';

export interface IntroQueenData {
    x: number; y: number;
    rotation: number;
    hasWings: boolean;
    wingPhase: number;
    wingAlpha: number;
    scale: number;
    // Fallen wings on the surface
    fallenX?: number;
    fallenY?: number;
    fallenAlpha?: number;
}

let _introQueenData: IntroQueenData | null = null;
let _introFallenWingsG: Graphics;
let _introWingsG: Graphics;
let _introQueenSpr: Sprite;

export function createIntroLayers(queenTex: Texture): {
    fallenWingsG: Graphics;
    wingsG: Graphics;
    queenSpr: Sprite;
} {
    _introFallenWingsG = new Graphics();
    _introWingsG = new Graphics();
    _introQueenSpr = new Sprite(queenTex);
    _introQueenSpr.anchor.set(0.5, ANT_AY);
    _introQueenSpr.scale.set(DISP);
    _introQueenSpr.visible = false;
    return { fallenWingsG: _introFallenWingsG, wingsG: _introWingsG, queenSpr: _introQueenSpr };
}

export function setIntroQueen(data: IntroQueenData | null): void {
    _introQueenData = data;
    if (!data) {
        _introQueenSpr.visible = false;
        _introWingsG.clear();
        _introFallenWingsG.clear();
    }
}

export function hasIntroData(): boolean {
    return _introQueenData !== null;
}

export function updateIntroQueen(): void {
    const d = _introQueenData!;

    // ── Fallen wings (lying flat on the surface) ─────────────────────────────
    _introFallenWingsG.clear();
    if (d.fallenX !== undefined && d.fallenY !== undefined && (d.fallenAlpha ?? 0) > 0) {
        const r = CELL * 0.55;        // base queen radius (scale 1.0)
        const fa = d.fallenAlpha!;
        const fx = d.fallenX, fy = d.fallenY;

        // Four flat wing ellipses scattered around the drop point.
        // Very thin height = lying flat on ground.
        _introFallenWingsG.ellipse(fx - r * 1.7, fy - r * 0.25, r * 2.0, r * 0.13).fill({ color: 0xd0e8ff, alpha: 0.45 * fa });
        _introFallenWingsG.ellipse(fx + r * 1.5, fy + r * 0.30, r * 1.9, r * 0.12).fill({ color: 0xd0e8ff, alpha: 0.45 * fa });
        _introFallenWingsG.ellipse(fx - r * 1.2, fy + r * 0.55, r * 1.4, r * 0.10).fill({ color: 0xb8d4ff, alpha: 0.40 * fa });
        _introFallenWingsG.ellipse(fx + r * 1.1, fy - r * 0.50, r * 1.3, r * 0.10).fill({ color: 0xb8d4ff, alpha: 0.40 * fa });
    }

    // ── Queen sprite ──────────────────────────────────────────────────────────
    _introQueenSpr.visible = true;
    _introQueenSpr.position.set(d.x, d.y);
    _introQueenSpr.rotation = d.rotation;
    _introQueenSpr.scale.set(DISP * d.scale);

    // ── Attached wings (rotate with queen) ───────────────────────────────────
    _introWingsG.clear();
    if (d.hasWings && d.wingAlpha > 0) {
        _introWingsG.position.set(d.x, d.y);
        _introWingsG.rotation = d.rotation;

        const r = CELL * 0.55 * d.scale;
        const ty = -r * 0.43;                    // thorax y in queen local space
        const f = 0.55 + 0.45 * Math.abs(Math.sin(d.wingPhase * Math.PI * 5));
        const wa = d.wingAlpha;

        _introWingsG.ellipse(-r * 1.3, ty - r * 0.1, r * 1.9 * f, r * 0.5 * f).fill({ color: 0xd0e8ff, alpha: 0.65 * wa });
        _introWingsG.ellipse(r * 1.3, ty - r * 0.1, r * 1.9 * f, r * 0.5 * f).fill({ color: 0xd0e8ff, alpha: 0.65 * wa });
        _introWingsG.ellipse(-r * 1.0, ty + r * 0.5, r * 1.4 * f, r * 0.38 * f).fill({ color: 0xb8d4ff, alpha: 0.55 * wa });
        _introWingsG.ellipse(r * 1.0, ty + r * 0.5, r * 1.4 * f, r * 0.38 * f).fill({ color: 0xb8d4ff, alpha: 0.55 * wa });
    }
}
