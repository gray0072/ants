import { Application, Container, Graphics, RenderTexture, Texture } from 'pixi.js';
import { AntType } from '../state';
import { CELL, DRAW_SCALE, ANT_HEX, ENM_HEX, FOOD_BASE_R, CARRY_FOOD_BASE_R, darken } from './constants';

// All drawn head-up (head at −Y), origin at body/thorax junction.
//
// frame 0 = stride A (front reach forward / back push behind)
// frame 1 = neutral
// frame 2 = stride B (opposite of A)
export function buildAnt(type: AntType, frame: number): Graphics {
    const g = new Graphics();
    const r = (type === 'queen' || type === 'princess' ? CELL * 0.55 : CELL * 0.38) * DRAW_SCALE;
    const c = ANT_HEX[type];
    const lc = type === 'worker' ? darken(c, 0.80) : darken(c, 0.60);

    // ── Per-frame tip offsets [dx, dy] for [front, mid, back] pairs ────────────
    const S = r * 0.20;
    const stride: [number, number][] =
        frame === 0 ? [[-S * 0.2, -S * 0.85], [S * 0.15, S * 0.45], [S * 0.2, S * 0.85]] :
            frame === 2 ? [[S * 0.2, S * 0.85], [-S * 0.15, -S * 0.45], [-S * 0.2, -S * 0.85]] :
                [[0, 0], [0, 0], [0, 0]];

    // ── Legs: front sweeps forward, back sweeps backward (not parallel) ─────────
    const legs: [number, number, number, number, number, number][] = [
        // front — elbow up-forward, tip lands ahead of attach point
        [r * 0.28, -r * 0.55, r * 0.98, -r * 0.82, r * 0.78 + stride[0][0], -r * 0.36 + stride[0][1]],
        // mid — nearly perpendicular, elbow level
        [r * 0.32, -r * 0.30, r * 1.22, -r * 0.04, r * 1.10 + stride[1][0], r * 0.50 + stride[1][1]],
        // back — elbow down-back, tip reaches well behind attach point
        [r * 0.25, r * 0.10, r * 1.04, r * 0.46, r * 0.85 + stride[2][0], r * 1.02 + stride[2][1]],
    ];
    for (const [ax, ay, mx, my, tx, ty] of legs) {
        g.moveTo(-ax, ay).lineTo(-mx, my).lineTo(-tx, ty);
        g.moveTo(ax, ay).lineTo(mx, my).lineTo(tx, ty);
    }
    g.stroke({ color: lc, width: r * 0.13, cap: 'round', join: 'round' });

    // ── Body segments ───────────────────────────────────────────────────────────
    g.ellipse(0, r * 0.54, r * 0.52, r * 0.72).fill(c);
    g.ellipse(r * 0.11, r * 0.27, r * 0.19, r * 0.26).fill({ color: 0xffffff, alpha: 0.13 });
    g.ellipse(0, r * 0.01, r * 0.11, r * 0.19).fill(c);
    g.ellipse(0, -r * 0.43, r * 0.37, r * 0.41).fill(c);

    // ── Head ───────────────────────────────────────────────────────────────────
    g.circle(0, -r * 1.05, r * 0.30).fill(c);
    g.circle(-r * 0.12, -r * 1.14, r * 0.075).fill(0x111111);
    g.circle(r * 0.12, -r * 1.14, r * 0.075).fill(0x111111);
    g.moveTo(-r * 0.18, -r * 1.30).lineTo(-r * 0.32, -r * 1.44);
    g.moveTo(r * 0.18, -r * 1.30).lineTo(r * 0.32, -r * 1.44);
    g.stroke({ color: lc, width: r * 0.13, cap: 'round' });

    // ── Antennae (spread on frame 0, tucked on frame 2) ────────────────────────
    const aOff = frame === 0 ? r * 0.13 : frame === 2 ? -r * 0.11 : 0;
    const aLift = frame === 0 ? -r * 0.10 : frame === 2 ? r * 0.08 : 0;
    const atX = r * 0.52 + aOff;
    const atY = -r * 2.01 + aLift;
    g.moveTo(-r * 0.10, -r * 1.28).lineTo(-atX, atY);
    g.moveTo(r * 0.10, -r * 1.28).lineTo(atX, atY);
    g.stroke({ color: c, width: r * 0.09, cap: 'round' });
    g.circle(-atX, atY, r * 0.09).fill(c);
    g.circle(atX, atY, r * 0.09).fill(c);

    if (type === 'queen') {
        g.circle(0, -r * 1.05, r * 0.15).fill(0xffee00);
    }

    // ── Folded wings (princesses) — drawn last so they overlay the body ────────
    if (type === 'princess') {
        g.ellipse(-r * 0.32, r * 0.44, r * 0.30, r * 1.06).fill({ color: 0xd0e8ff, alpha: 0.48 });
        g.ellipse(r * 0.32, r * 0.44, r * 0.30, r * 1.06).fill({ color: 0xd0e8ff, alpha: 0.48 });
        g.moveTo(-r * 0.32, -r * 0.28).lineTo(-r * 0.32, r * 1.50);
        g.moveTo(r * 0.32, -r * 0.28).lineTo(r * 0.32, r * 1.50);
        g.stroke({ color: 0xa8c8f0, width: r * 0.05, alpha: 0.55 });
    }

    return g;
}

export function buildBeetle(): Graphics {
    const g = new Graphics();
    const r = CELL * 0.45 * DRAW_SCALE;
    const c = ENM_HEX.beetle;
    // Legs
    for (let i = 0; i < 3; i++) {
        const ly = -r * 0.5 + i * r * 0.5;
        g.moveTo(-r * 0.80, ly).lineTo(-r * 1.32, ly + r * 0.22);
        g.moveTo(r * 0.80, ly).lineTo(r * 1.32, ly + r * 0.22);
    }
    g.stroke({ color: 0x2a2a38, width: r * 0.10, cap: 'round' });
    // Elytra (wing covers)
    g.ellipse(0, 0, r * 0.80, r).fill(c);
    g.moveTo(0, -r).lineTo(0, r).stroke({ color: 0x666677, width: r * 0.07 });
    // Pronotum
    g.ellipse(0, -r * 1.0, r * 0.50, r * 0.30).fill(darken(c, 0.8));
    // Head
    g.circle(0, -r * 1.25, r * 0.22).fill(darken(c, 0.7));
    // Antennae
    g.moveTo(-r * 0.10, -r * 1.40).lineTo(-r * 0.45, -r * 1.92);
    g.moveTo(r * 0.10, -r * 1.40).lineTo(r * 0.45, -r * 1.92);
    g.stroke({ color: 0x555566, width: r * 0.08, cap: 'round' });
    return g;
}

export function buildSpider(): Graphics {
    const g = new Graphics();
    const r = CELL * 0.45 * DRAW_SCALE;
    const c = ENM_HEX.spider;
    // 8 bent legs (evenly spaced)
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        g.moveTo(ca * r * 0.55, sa * r * 0.55)
            .lineTo(ca * r * 1.10 + sa * r * 0.28, sa * r * 1.10 - ca * r * 0.28)
            .lineTo(ca * r * 1.48, sa * r * 1.48);
    }
    g.stroke({ color: darken(c, 0.65), width: r * 0.09, cap: 'round' });
    // Abdomen (opisthosoma) — larger rear
    g.ellipse(0, r * 0.38, r * 0.46, r * 0.56).fill(c);
    // Sheen
    g.ellipse(r * 0.08, r * 0.18, r * 0.16, r * 0.22).fill({ color: 0xffffff, alpha: 0.10 });
    // Cephalothorax (prosoma)
    g.circle(0, -r * 0.10, r * 0.48).fill(darken(c, 0.85));
    // Eye cluster (4 red dots)
    for (let ex = -1; ex <= 1; ex += 2) {
        g.circle(ex * r * 0.18, -r * 0.24, r * 0.07).fill(0xff2222);
        g.circle(ex * r * 0.09, -r * 0.11, r * 0.055).fill(0xff4444);
    }
    // Chelicerae (fangs)
    g.moveTo(-r * 0.15, -r * 0.52).lineTo(-r * 0.22, -r * 0.72);
    g.moveTo(r * 0.15, -r * 0.52).lineTo(r * 0.22, -r * 0.72);
    g.stroke({ color: darken(c, 0.5), width: r * 0.11, cap: 'round' });
    return g;
}

export function buildFoodPellet(): Graphics {
    const g = new Graphics();
    const r = CELL * FOOD_BASE_R * DRAW_SCALE;
    g.circle(r * 0.14, r * 0.18, r * 0.90).fill({ color: 0x1e5c08, alpha: 0.80 });
    g.circle(0, 0, r).fill(0x5ecf22);
    g.circle(-r * 0.30, -r * 0.28, r * 0.36).fill({ color: 0xccff88, alpha: 0.65 });
    return g;
}

export function buildNestMarker(): Graphics {
    const g = new Graphics();
    const r = CELL * 2.5 * DRAW_SCALE;
    g.circle(0, 0, r).stroke({ color: 0xc864dc, alpha: 0.60, width: 1.5 * DRAW_SCALE });
    return g;
}

export function buildCarryFood(): Graphics {
    const g = new Graphics();
    const r = CELL * CARRY_FOOD_BASE_R * DRAW_SCALE;
    g.circle(0, 0, r * 0.38).fill({ color: 0xaaff44, alpha: 0.35 });
    g.circle(0, 0, r * 0.22).fill(0x80c840);
    g.ellipse(-r * 0.07, -r * 0.06, r * 0.08, r * 0.06).fill({ color: 0xffffff, alpha: 0.50 });
    return g;
}

export function buildCarryEgg(): Graphics {
    const g = new Graphics();
    // White so sprite.tint can recolour it per ant type
    g.ellipse(0, 0, CELL * 0.14 * DRAW_SCALE, CELL * 0.19 * DRAW_SCALE)
        .fill({ color: 0xffffff, alpha: 0.92 });
    return g;
}

export function buildEgg(): Graphics {
    const g = new Graphics();
    const rx = CELL * 0.22 * DRAW_SCALE, ry = CELL * 0.30 * DRAW_SCALE;
    g.ellipse(0, 0, rx, ry).fill({ color: 0xffffff, alpha: 0.80 });
    // Sheen highlight
    g.ellipse(-rx * 0.22, -ry * 0.30, rx * 0.32, ry * 0.34).fill({ color: 0xffffff, alpha: 0.38 });
    return g;
}

export function buildLarva(): Graphics {
    const g = new Graphics();
    const rx = CELL * 0.28 * DRAW_SCALE, ry = CELL * 0.22 * DRAW_SCALE;
    // Body
    g.ellipse(0, 0, rx, ry).fill(0xf5f0d0);
    // Segments
    for (let i = -1; i <= 1; i++) {
        g.moveTo(i * CELL * 0.09 * DRAW_SCALE, -ry).lineTo(i * CELL * 0.09 * DRAW_SCALE, ry);
    }
    g.stroke({ color: 0xb4a050, alpha: 0.45, width: DRAW_SCALE * 0.7 });
    // Head
    g.circle(0, -ry * 0.75, CELL * 0.10 * DRAW_SCALE).fill({ color: 0xaaaaaa, alpha: 0.60 });
    return g;
}

export function buildPupa(): Graphics {
    const g = new Graphics();
    const rx = CELL * 0.25 * DRAW_SCALE, ry = CELL * 0.36 * DRAW_SCALE;
    g.ellipse(0, 0, rx, ry).fill({ color: 0xffffff, alpha: 0.55 });
    // Wrapping bands
    for (let i = -1; i <= 1; i++) {
        g.ellipse(0, i * ry * 0.30, rx, ry * 0.30)
            .stroke({ color: 0xffffff, alpha: 0.28, width: DRAW_SCALE * 0.9 });
    }
    // Faint ant silhouette
    g.ellipse(0, 0, rx * 0.52, ry * 0.62)
        .stroke({ color: 0xffffff, alpha: 0.38, width: DRAW_SCALE * 0.7 });
    return g;
}

export function bakeTexture(
    app: Application,
    g: Graphics,
    w: number, h: number,
    cx: number, cy: number,
): Texture {
    const wrap = new Container();
    g.position.set(cx, cy);
    wrap.addChild(g);
    const rt = RenderTexture.create({ width: w, height: h, antialias: true });
    app.renderer.render({ container: wrap, target: rt });
    return rt;
}
