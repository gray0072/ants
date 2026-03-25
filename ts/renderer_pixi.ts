// WebGL renderer via PixiJS v8 — replaces canvas 2D renderer
import {
  Application, BufferImageSource, Container, Graphics,
  RenderTexture, Sprite, Texture,
} from 'pixi.js';
import { CONFIG } from './config';
import { STATE, AntType, CellType } from './state';

// ─── Layout constants ────────────────────────────────────────────────────────

const CELL  = CONFIG.CELL;
const MAP_W = CONFIG.COLS * CELL;
const MAP_H = CONFIG.ROWS * CELL;

// Sprites are pre-rendered at 2× game pixels for crisp sub-pixel detail,
// then displayed at DISP (0.5×) so they occupy the correct game area.
const DRAW_SCALE = 2;
const DISP       = 1 / DRAW_SCALE;

// Ant sprite canvas (pixels at DRAW_SCALE).
// Body/thorax junction sits at ANT_CX, ANT_CY within the texture.
const ANT_W  = 48;
const ANT_H  = 64;
const ANT_CX = ANT_W / 2;          // 24
const ANT_CY = ANT_H * 0.625;      // 40  (leaves ~24 px above for antennae)
const ANT_AY = ANT_CY / ANT_H;     // anchor Y fraction ≈ 0.625

const ENM_SZ = 64;   // enemy sprite (square, centre = 32,32)

const EGG_W = 24,  EGG_H = 28;
const LAR_W = 36,  LAR_H = 30;
const PUP_W = 30,  PUP_H = 40;

// ─── Color palette ───────────────────────────────────────────────────────────

const ANT_HEX: Record<AntType, number> = {
  worker: 0xd4a96a,
  soldier: 0xcc3333,
  scout:   0xe8d44d,
  queen:   0xcc44cc,
  nurse:   0x7ec8e3,
};
const ENM_HEX = { beetle: 0x444455, spider: 0x882222 } as const;

function darken(c: number, f = 0.55): number {
  return (((c >> 16 & 0xff) * f | 0) << 16)
       | (((c >>  8 & 0xff) * f | 0) <<  8)
       |  ((c       & 0xff) * f | 0);
}

// ─── Map pixel buffer helpers (identical logic to canvas renderer) ────────────

function pack(r: number, g: number, b: number): number {
  return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
}
function blend(base: number, r2: number, g2: number, b2: number, a: number): number {
  const ia = 1 - a;
  return pack(
    ((base       & 0xff) * ia + r2 * a + 0.5) | 0,
    ((base >>  8 & 0xff) * ia + g2 * a + 0.5) | 0,
    ((base >> 16 & 0xff) * ia + b2 * a + 0.5) | 0,
  );
}
const TILE_CLR: Record<CellType, number> = {
  soil:    pack(0x3d, 0x2b, 0x1a),
  surface: pack(0x6b, 0x4c, 0x2a),
  tunnel:  pack(0x7a, 0x5c, 0x3a),
  chamber: pack(0x8b, 0x6a, 0x45),
};

// ─── Module state ─────────────────────────────────────────────────────────────

let _app:       Application;
let _mapSrc:    BufferImageSource;
let _mapBuf32:  Uint32Array;
let _entities:    Container;
let _stagesLayer: Container;   // eggs / larva / pupa — rendered below ants
let _adultsLayer: Container;   // adult ants + enemies
let _overlay:   Graphics;

const _antTex  = new Map<string, Texture>();   // AntType → adult sprite
const _enmTex  = new Map<string, Texture>();   // 'beetle' | 'spider'
let _eggTex:   Texture;
let _larvaTex: Texture;
let _pupaTex:  Texture;

const _antPool:   Sprite[] = [];
const _stagePool: Sprite[] = [];   // eggs / larva / pupa
const _enmPool:   Sprite[] = [];

// ─── Intro animation ──────────────────────────────────────────────────────────

interface IntroQueenData {
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

// ─── Graphics builders ────────────────────────────────────────────────────────
// All drawn head-up (head at −Y), origin at body/thorax junction.

function buildAnt(type: AntType): Graphics {
  const g  = new Graphics();
  const r  = (type === 'queen' ? CELL * 0.55 : CELL * 0.38) * DRAW_SCALE;
  const c  = ANT_HEX[type];
  const lc = darken(c, 0.60);

  // ── Legs (3 pairs, drawn behind body) ──────────────────────────────────────
  // Each triplet: [attachX, attachY, midX, midY, tipX, tipY] for RIGHT side.
  // Left side is mirrored on X.
  const legs: [number,number,number,number,number,number][] = [
    [r*0.30, -r*0.60,  r*1.10, -r*0.68,  r*0.96, -r*0.04],  // front
    [r*0.32, -r*0.35,  r*1.15, -r*0.12,  r*1.00,  r*0.42],  // mid
    [r*0.27, -r*0.06,  r*1.08,  r*0.26,  r*0.94,  r*0.74],  // back
  ];
  for (const [ax, ay, mx, my, tx, ty] of legs) {
    g.moveTo(-ax, ay).lineTo(-mx, my).lineTo(-tx, ty);
    g.moveTo( ax, ay).lineTo( mx, my).lineTo( tx, ty);
  }
  g.stroke({ color: lc, width: r * 0.13, cap: 'round', join: 'round' });

  // ── Body segments ───────────────────────────────────────────────────────────
  // Abdomen (gaster) — largest segment, lower
  g.ellipse(0, r * 0.54, r * 0.52, r * 0.72).fill(c);
  // Subtle sheen on abdomen
  g.ellipse(r * 0.11, r * 0.27, r * 0.19, r * 0.26).fill({ color: 0xffffff, alpha: 0.13 });
  // Petiole — thin waist
  g.ellipse(0, r * 0.01, r * 0.11, r * 0.19).fill(c);
  // Thorax (mesosoma)
  g.ellipse(0, -r * 0.43, r * 0.37, r * 0.41).fill(c);

  // ── Head ───────────────────────────────────────────────────────────────────
  g.circle(0, -r * 1.05, r * 0.30).fill(c);
  // Eyes
  g.circle(-r * 0.12, -r * 1.14, r * 0.075).fill(0x111111);
  g.circle( r * 0.12, -r * 1.14, r * 0.075).fill(0x111111);
  // Mandibles
  g.moveTo(-r * 0.18, -r * 1.30).lineTo(-r * 0.32, -r * 1.44);
  g.moveTo( r * 0.18, -r * 1.30).lineTo( r * 0.32, -r * 1.44);
  g.stroke({ color: lc, width: r * 0.13, cap: 'round' });

  // ── Antennae ───────────────────────────────────────────────────────────────
  g.moveTo(-r * 0.10, -r * 1.28).lineTo(-r * 0.52, -r * 2.01);
  g.moveTo( r * 0.10, -r * 1.28).lineTo( r * 0.52, -r * 2.01);
  g.stroke({ color: c, width: r * 0.09, cap: 'round' });
  // Antennal clubs
  g.circle(-r * 0.52, -r * 2.01, r * 0.09).fill(c);
  g.circle( r * 0.52, -r * 2.01, r * 0.09).fill(c);

  // Queen crown dot
  if (type === 'queen') {
    g.circle(0, -r * 1.05, r * 0.15).fill(0xffee00);
  }
  return g;
}

function buildBeetle(): Graphics {
  const g = new Graphics();
  const r = CELL * 0.45 * DRAW_SCALE;
  const c = ENM_HEX.beetle;
  // Legs
  for (let i = 0; i < 3; i++) {
    const ly = -r * 0.5 + i * r * 0.5;
    g.moveTo(-r * 0.80, ly).lineTo(-r * 1.32, ly + r * 0.22);
    g.moveTo( r * 0.80, ly).lineTo( r * 1.32, ly + r * 0.22);
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
  g.moveTo( r * 0.10, -r * 1.40).lineTo( r * 0.45, -r * 1.92);
  g.stroke({ color: 0x555566, width: r * 0.08, cap: 'round' });
  return g;
}

function buildSpider(): Graphics {
  const g = new Graphics();
  const r = CELL * 0.45 * DRAW_SCALE;
  const c = ENM_HEX.spider;
  // 8 bent legs (evenly spaced)
  for (let i = 0; i < 8; i++) {
    const a  = (i / 8) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    g.moveTo(ca * r * 0.55,  sa * r * 0.55)
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
  g.moveTo( r * 0.15, -r * 0.52).lineTo( r * 0.22, -r * 0.72);
  g.stroke({ color: darken(c, 0.5), width: r * 0.11, cap: 'round' });
  return g;
}

function buildEgg(): Graphics {
  const g = new Graphics();
  const rx = CELL * 0.22 * DRAW_SCALE, ry = CELL * 0.30 * DRAW_SCALE;
  g.ellipse(0, 0, rx, ry).fill({ color: 0xffffff, alpha: 0.80 });
  // Sheen highlight
  g.ellipse(-rx * 0.22, -ry * 0.30, rx * 0.32, ry * 0.34).fill({ color: 0xffffff, alpha: 0.38 });
  return g;
}

function buildLarva(): Graphics {
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

function buildPupa(): Graphics {
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

// ─── Texture generation ───────────────────────────────────────────────────────

function bakeTexture(
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

// ─── Sprite pool helpers ──────────────────────────────────────────────────────

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

// ─── Per-frame update functions ───────────────────────────────────────────────

function updateMap(): void {
  const { COLS, ROWS, FOOD_AMOUNT } = CONFIG;
  const buf  = _mapBuf32;
  const food = STATE.foodGrid!;
  const pher = STATE.pheromone!;
  const fog  = STATE.fog!;
  if (!food || !pher || !fog) return;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      let col = TILE_CLR[STATE.map[i] as CellType] ?? 0xff000000;
      if (food[i] > 0) {
        const t = Math.min(1, food[i] / FOOD_AMOUNT);
        col = blend(col, 100, 200, 80, 0.4 + t * 0.6);
      }
      if (pher[i] > 0) col = blend(col, 80, 220, 120, pher[i] * 0.5);
      if (fog[i]  < 1) col = blend(col, 0, 0, 0, 0.82 * (1 - fog[i]));

      const x0 = c * CELL, y0 = r * CELL;
      for (let py = 0; py < CELL; py++) {
        buf.fill(col, (y0 + py) * MAP_W + x0, (y0 + py) * MAP_W + x0 + CELL);
      }
    }
  }
  _mapSrc.update();
}

function updateEntities(): void {
  const fog = STATE.fog;
  let ai = 0;

  let si = 0;
  for (const ant of STATE.ants) {
    if (ant._carried) continue;
    const col = Math.round(ant.col), row = Math.round(ant.row);
    if (fog && STATE.inBounds(col, row) && fog[STATE.idx(col, row)] <= 0) continue;

    const isDev = ant.lifestage === 'egg' || ant.lifestage === 'larva' || ant.lifestage === 'pupa';
    if (isDev) {
      const s = stageSprite(si++);
      s.visible = true;
      s.position.set(ant.col * CELL, ant.row * CELL);
      s.tint = 0xffffff;
      s.rotation = 0;
      if (ant.lifestage === 'egg') {
        s.texture = _eggTex;
        s.tint    = ANT_HEX[ant.type as AntType] ?? 0xffffff;
      } else if (ant.lifestage === 'larva') {
        s.texture = _larvaTex;
      } else {
        s.texture = _pupaTex;
        s.tint    = ANT_HEX[ant.type as AntType] ?? 0xffffff;
      }
    } else {
      const s = antSprite(ai++);
      s.visible = true;
      s.position.set(ant.col * CELL, ant.row * CELL);
      s.tint     = 0xffffff;
      s.texture  = _antTex.get(ant.type) ?? Texture.EMPTY;
      s.anchor.set(0.5, ANT_AY);
      s.rotation = (ant.angle ?? -Math.PI / 2) + Math.PI / 2;
    }
  }
  for (let i = si; i < _stagePool.length; i++) _stagePool[i].visible = false;
  for (let i = ai; i < _antPool.length; i++) _antPool[i].visible = false;

  // Enemies
  let ei = 0;
  for (const e of STATE.enemies) {
    const col = Math.floor(e.col), row = Math.floor(e.row);
    if (fog && STATE.inBounds(col, row) && fog[STATE.idx(col, row)] <= 0) continue;

    const s = enmSprite(ei++);
    s.visible  = true;
    s.position.set(e.col * CELL, e.row * CELL);
    s.texture  = _enmTex.get(e.type) ?? Texture.EMPTY;
    s.rotation = (e.angle ?? Math.PI / 2) + Math.PI / 2;
    s.tint     = 0xffffff;
  }
  for (let i = ei; i < _enmPool.length; i++) _enmPool[i].visible = false;
}

function updateOverlay(): void {
  const g   = _overlay;
  const fog = STATE.fog;
  g.clear();

  // Nest marker
  const nx = STATE.nestCol * CELL + CELL / 2;
  const ny = STATE.nestRow * CELL + CELL / 2;
  g.circle(nx, ny, CELL * 2.5)
   .stroke({ color: 0xc864dc, alpha: 0.60, width: 1.5 });

  // Carried items (food pellets, nurse eggs)
  for (const ant of STATE.ants) {
    if (ant._carried || ant.lifestage) continue;
    const col = Math.round(ant.col), row = Math.round(ant.row);
    if (fog && STATE.inBounds(col, row) && fog[STATE.idx(col, row)] <= 0) continue;

    const r = ant.type === 'queen' ? CELL * 0.55 : CELL * 0.38;
    const θ = (ant.angle ?? -Math.PI / 2) + Math.PI / 2;
    const cosθ = Math.cos(θ), sinθ = Math.sin(θ);

    if (ant.carrying > 0) {
      // local (0, -r*1.42) → world
      const wx = r * 1.42 * sinθ + ant.col * CELL;
      const wy = -r * 1.42 * cosθ + ant.row * CELL;
      g.circle(wx, wy, r * 0.38).fill({ color: 0xaaff44, alpha: 0.35 });
      g.circle(wx, wy, r * 0.22).fill(0x80c840);
      g.ellipse(wx - r * 0.07, wy - r * 0.06, r * 0.08, r * 0.06)
       .fill({ color: 0xffffff, alpha: 0.50 });
    }
    if (ant.type === 'nurse' && ant.carriedEgg) {
      const wx = r * 1.55 * sinθ + ant.col * CELL;
      const wy = -r * 1.55 * cosθ + ant.row * CELL;
      const ec = ANT_HEX[ant.carriedEgg.type as AntType] ?? 0xffffff;
      g.ellipse(wx, wy, CELL * 0.14, CELL * 0.19).fill({ color: ec, alpha: 0.92 });
    }
  }

  // HP bars — ants
  for (const ant of STATE.ants) {
    if (ant._carried || ant.hp >= ant.maxHp) continue;
    const col = Math.round(ant.col), row = Math.round(ant.row);
    if (fog && STATE.inBounds(col, row) && fog[STATE.idx(col, row)] <= 0) continue;
    const r  = ant.type === 'queen' ? CELL * 0.55 : CELL * 0.38;
    const bw = CELL * 1.2, bh = 2;
    const bx = ant.col * CELL - bw / 2, by = ant.row * CELL - r - 6;
    g.rect(bx, by, bw, bh).fill(0x550000);
    g.rect(bx, by, bw * (ant.hp / ant.maxHp), bh).fill(0x00ee00);
  }

  // HP bars — enemies
  for (const e of STATE.enemies) {
    if (e.hp >= e.maxHp) continue;
    const col = Math.floor(e.col), row = Math.floor(e.row);
    if (fog && STATE.inBounds(col, row) && fog[STATE.idx(col, row)] <= 0) continue;
    const r  = CELL * 0.45;
    const bw = CELL * 1.2, bh = 2;
    const bx = e.col * CELL - bw / 2, by = e.row * CELL - r - 5;
    g.rect(bx, by, bw, bh).fill(0x550000);
    g.rect(bx, by, bw * (e.hp / e.maxHp), bh).fill(0xff5500);
  }
}

// ─── Intro queen rendering ────────────────────────────────────────────────────

function updateIntroQueen(): void {
  const d = _introQueenData!;

  // ── Fallen wings (lying flat on the surface) ─────────────────────────────
  _introFallenWingsG.clear();
  if (d.fallenX !== undefined && d.fallenY !== undefined && (d.fallenAlpha ?? 0) > 0) {
    const r  = CELL * 0.55;        // base queen radius (scale 1.0)
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

    const r  = CELL * 0.55 * d.scale;
    const ty = -r * 0.43;                    // thorax y in queen local space
    const f  = 0.55 + 0.45 * Math.abs(Math.sin(d.wingPhase * Math.PI * 5));
    const wa = d.wingAlpha;

    _introWingsG.ellipse(-r * 1.3, ty - r * 0.1, r * 1.9 * f, r * 0.5 * f).fill({ color: 0xd0e8ff, alpha: 0.65 * wa });
    _introWingsG.ellipse( r * 1.3, ty - r * 0.1, r * 1.9 * f, r * 0.5 * f).fill({ color: 0xd0e8ff, alpha: 0.65 * wa });
    _introWingsG.ellipse(-r * 1.0, ty + r * 0.5, r * 1.4 * f, r * 0.38 * f).fill({ color: 0xb8d4ff, alpha: 0.55 * wa });
    _introWingsG.ellipse( r * 1.0, ty + r * 0.5, r * 1.4 * f, r * 0.38 * f).fill({ color: 0xb8d4ff, alpha: 0.55 * wa });
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const Renderer = {
  async init(canvas: HTMLCanvasElement): Promise<void> {
    _app = new Application();
    await _app.init({
      canvas: canvas as unknown as HTMLCanvasElement,
      width:  MAP_W,
      height: MAP_H,
      antialias:       true,
      resolution:      1,
      autoDensity:     false,
      backgroundColor: 0x000000,
      autoStart:       false,   // we drive the render loop ourselves
    } as Parameters<Application['init']>[0]);

    // ── Map layer ─────────────────────────────────────────────────────────────
    const mapPixels = new Uint8Array(MAP_W * MAP_H * 4);
    _mapBuf32 = new Uint32Array(mapPixels.buffer);
    _mapSrc   = new BufferImageSource({ resource: mapPixels, width: MAP_W, height: MAP_H });
    const mapSprite = new Sprite(new Texture({ source: _mapSrc }));
    _app.stage.addChild(mapSprite);

    // ── Entity layer ──────────────────────────────────────────────────────────
    _entities = new Container();
    _stagesLayer = new Container();   // below ants
    _adultsLayer = new Container();   // above stages
    _entities.addChild(_stagesLayer);
    _entities.addChild(_adultsLayer);
    _app.stage.addChild(_entities);

    // ── Overlay (HP bars, carried items, nest ring) ───────────────────────────
    _overlay = new Graphics();
    _app.stage.addChild(_overlay);

    // ── Pre-bake all textures ──────────────────────────────────────────────────
    for (const type of ['worker', 'soldier', 'scout', 'queen', 'nurse'] as AntType[]) {
      _antTex.set(type, bakeTexture(_app, buildAnt(type), ANT_W, ANT_H, ANT_CX, ANT_CY));
    }
    _enmTex.set('beetle', bakeTexture(_app, buildBeetle(), ENM_SZ, ENM_SZ, ENM_SZ/2, ENM_SZ/2));
    _enmTex.set('spider', bakeTexture(_app, buildSpider(), ENM_SZ, ENM_SZ, ENM_SZ/2, ENM_SZ/2));
    _eggTex  = bakeTexture(_app, buildEgg(),   EGG_W, EGG_H, EGG_W/2, EGG_H/2);
    _larvaTex = bakeTexture(_app, buildLarva(), LAR_W, LAR_H, LAR_W/2, LAR_H/2);
    _pupaTex  = bakeTexture(_app, buildPupa(),  PUP_W, PUP_H, PUP_W/2, PUP_H/2);

    // ── Intro animation layer (above overlay) ─────────────────────────────────
    _introFallenWingsG = new Graphics();            // shed wings lying on ground
    _introWingsG       = new Graphics();            // attached wings (rotates with queen)
    _introQueenSpr     = new Sprite(_antTex.get('queen')!);
    _introQueenSpr.anchor.set(0.5, ANT_AY);
    _introQueenSpr.scale.set(DISP);
    _introQueenSpr.visible = false;
    _app.stage.addChild(_introFallenWingsG);        // below attached wings & queen
    _app.stage.addChild(_introWingsG);
    _app.stage.addChild(_introQueenSpr);
  },

  render(): void {
    if (!_app) return;
    updateMap();
    updateEntities();
    updateOverlay();
    if (_introQueenData) updateIntroQueen();
    _app.renderer.render(_app.stage);
  },

  setIntroQueen(data: IntroQueenData | null): void {
    _introQueenData = data;
    if (!data) {
      _introQueenSpr.visible = false;
      _introWingsG.clear();
      _introFallenWingsG.clear();
    }
  },

  destroy(): void {
    _app?.destroy(false);
  },
};
