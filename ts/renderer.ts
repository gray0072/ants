import { CONFIG } from './config';
import { STATE, Ant, Enemy, AntType, CellType } from './state';

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
const CELL = CONFIG.CELL;
let imageData: ImageData | null = null;
let buf32: Uint32Array | null = null;
let canvasW = 0;

// Pack RGBA into Uint32 (little-endian: R in low byte)
function pack(r: number, g: number, b: number): number {
  return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
}

function blend(base: number, r2: number, g2: number, b2: number, a: number): number {
  const ia = 1 - a;
  return pack(
    ((base & 0xff) * ia + r2 * a + 0.5) | 0,
    (((base >> 8) & 0xff) * ia + g2 * a + 0.5) | 0,
    (((base >> 16) & 0xff) * ia + b2 * a + 0.5) | 0,
  );
}

const TILE_COLORS: Record<CellType, number> = {
  soil: pack(0x3d, 0x2b, 0x1a),
  surface: pack(0x6b, 0x4c, 0x2a),
  tunnel: pack(0x7a, 0x5c, 0x3a),
  chamber: pack(0x8b, 0x6a, 0x45),
};

// Colors for entities (canvas 2D)
const COLORS: Record<AntType | 'beetle' | 'spider', string> = {
  worker: '#d4a96a',
  soldier: '#cc3333',
  scout: '#e8d44d',
  queen: '#cc44cc',
  nurse: '#7ec8e3',
  beetle: '#444455',
  spider: '#882222',
};

// Reusable per-frame antenna accumulator: color → flat [x0,y0,x1,y1, ...] segments
const _antennaBuf = new Map<string, number[]>();

export const Renderer = {
  init(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = CONFIG.COLS * CELL;
    canvas.height = CONFIG.ROWS * CELL;
    canvasW = canvas.width;
    imageData = ctx.createImageData(canvasW, canvas.height);
    buf32 = new Uint32Array(imageData.data.buffer);
  },

  drawMap(): void {
    if (!ctx || !imageData || !buf32) return;
    const { COLS, ROWS, FOOD_AMOUNT } = CONFIG;
    const foodGrid = STATE.foodGrid;
    const pheromone = STATE.pheromone;
    const fog = STATE.fog;
    if (!foodGrid || !pheromone || !fog) return;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        let color = TILE_COLORS[STATE.map[i] as CellType] || 0xff000000;

        if (foodGrid[i] > 0) {
          const t = Math.min(1, foodGrid[i] / FOOD_AMOUNT);
          color = blend(color, 100, 200, 80, 0.4 + t * 0.6);
        }
        if (pheromone[i] > 0) {
          color = blend(color, 80, 220, 120, pheromone[i] * 0.5);
        }
        if (fog[i] < 1) {
          color = blend(color, 0, 0, 0, 0.82 * (1 - fog[i]));
        }

        // Fill CELL×CELL pixel block
        const x0 = c * CELL, y0 = r * CELL;
        for (let py = 0; py < CELL; py++) {
          buf32.fill(color, (y0 + py) * canvasW + x0, (y0 + py) * canvasW + x0 + CELL);
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
  },

  drawEgg(ant: Ant): void {
    if (!ctx) return;
    const x = ant.col * CELL;
    const y = ant.row * CELL;
    const color = COLORS[ant.type as AntType] || '#fff';
    ctx.setTransform(1, 0, 0, 1, x, y);
    // Oval egg
    ctx.beginPath();
    ctx.ellipse(0, 0, CELL * 0.22, CELL * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.75;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
    // Sheen highlight
    ctx.beginPath();
    ctx.ellipse(-CELL * 0.06, -CELL * 0.1, CELL * 0.07, CELL * 0.1, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  },

  drawLarva(ant: Ant): void {
    if (!ctx) return;
    const x = ant.col * CELL;
    const y = ant.row * CELL;
    ctx.setTransform(1, 0, 0, 1, x, y);
    // Grub body — cream segmented blob
    ctx.beginPath();
    ctx.ellipse(0, 0, CELL * 0.28, CELL * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f5f0d0';
    ctx.fill();
    // Segments
    ctx.strokeStyle = 'rgba(180,160,80,0.5)';
    ctx.lineWidth = 0.6;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL * 0.09, -CELL * 0.22);
      ctx.lineTo(i * CELL * 0.09, CELL * 0.22);
      ctx.stroke();
    }
    // Head dot — tinted with ant's color
    ctx.beginPath();
    ctx.arc(0, -CELL * 0.16, CELL * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = COLORS[ant.type as AntType] || '#aaa';
    ctx.globalAlpha = 0.6;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  },

  drawPupa(ant: Ant): void {
    if (!ctx) return;
    const x = ant.col * CELL;
    const y = ant.row * CELL;
    const color = COLORS[ant.type as AntType] || '#fff';
    ctx.setTransform(1, 0, 0, 1, x, y);
    // Cocoon silhouette — darker, wrapped look
    ctx.beginPath();
    ctx.ellipse(0, 0, CELL * 0.25, CELL * 0.36, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.globalAlpha = 1;
    // Wrapping lines
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 0.8;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(0, i * CELL * 0.1, CELL * 0.25, CELL * 0.1, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Faint ant outline visible inside
    ctx.beginPath();
    ctx.ellipse(0, 0, CELL * 0.13, CELL * 0.22, 0, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  },

  drawAnt(ant: Ant, antennae: Map<string, number[]>): void {
    if (!ctx) return;
    if (ant.lifestage === 'egg') { this.drawEgg(ant); return; }
    if (ant.lifestage === 'larva') { this.drawLarva(ant); return; }
    if (ant.lifestage === 'pupa') { this.drawPupa(ant); return; }

    const x = ant.col * CELL;
    const y = ant.row * CELL;
    const r = ant.type === 'queen' ? CELL * 0.55 : CELL * 0.38;
    const angle = ant.angle ?? -Math.PI / 2;
    const θ = angle + Math.PI / 2;
    const cosθ = Math.cos(θ);
    const sinθ = Math.sin(θ);

    // setTransform replaces save/translate/rotate — no matrix stack push/pop
    ctx.setTransform(cosθ, sinθ, -sinθ, cosθ, x, y);

    // Body — ellipse: narrow width, long height; head = top (negative y)
    const color = COLORS[ant.type as AntType] || '#fff';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.55, r, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Head
    ctx.beginPath();
    ctx.arc(0, -r * 0.85, r * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Accumulate antennae as world-space segments for batch stroke later.
    // local (lx,ly) → world: (lx*cosθ - ly*sinθ + x, lx*sinθ + ly*cosθ + y)
    const rootWx = r * 0.85 * sinθ + x;           // lx=0, ly=-r*0.85
    const rootWy = -r * 0.85 * cosθ + y;
    const leftWx = -r * 0.7 * cosθ + r * 1.7 * sinθ + x;
    const leftWy = -r * 0.7 * sinθ - r * 1.7 * cosθ + y;
    const rightWx = r * 0.7 * cosθ + r * 1.7 * sinθ + x;
    const rightWy = r * 0.7 * sinθ - r * 1.7 * cosθ + y;
    let arr = antennae.get(color);
    if (!arr) { arr = []; antennae.set(color, arr); }
    arr.push(rootWx, rootWy, leftWx, leftWy, rootWx, rootWy, rightWx, rightWy);

    // Egg in mandibles — drawn in rotated space, held at the head tip
    if (ant.type === 'nurse' && ant.carriedEgg) {
      const eColor = COLORS[ant.carriedEgg.type as AntType] || '#fff';
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.ellipse(0, -r * 1.55, CELL * 0.14, CELL * 0.19, 0, 0, Math.PI * 2);
      ctx.fillStyle = eColor;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Food pellet in mandibles — rotated space, clamped between antenna roots
    if (ant.carrying > 0) {
      const fy = -r * 1.42;
      // Glow
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(0, fy, r * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = '#aaff44';
      ctx.fill();
      // Pellet body
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.ellipse(0, fy, r * 0.22, r * 0.18, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#80c840';
      ctx.fill();
      ctx.strokeStyle = 'rgba(200,255,100,0.7)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
      // Highlight
      ctx.beginPath();
      ctx.ellipse(-r * 0.07, fy - r * 0.06, r * 0.08, r * 0.06, -0.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
    }

    // Reset transform before drawing HP bar in world space
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // HP bar — drawn in world space, above ant (not rotated)
    if (ant.hp < ant.maxHp) {
      const bw = CELL * 1.2;
      const bh = 2;
      ctx.fillStyle = '#500';
      ctx.fillRect(x - bw / 2, y - r - 6, bw, bh);
      ctx.fillStyle = '#0f0';
      ctx.fillRect(x - bw / 2, y - r - 6, bw * (ant.hp / ant.maxHp), bh);
    }
  },

  drawEnemy(e: Enemy): void {
    if (!ctx) return;
    const x = e.col * CELL;
    const y = e.row * CELL;
    const r = CELL * 0.45;
    const i = STATE.idx(Math.floor(e.col), Math.floor(e.row));
    const fog = STATE.fog;
    if (STATE.inBounds(Math.floor(e.col), Math.floor(e.row)) && fog && fog[i] <= 0) return;

    const eAngle = (e.angle ?? Math.PI / 2) + Math.PI / 2;
    const cosA = Math.cos(eAngle), sinA = Math.sin(eAngle);
    ctx.setTransform(cosA, sinA, -sinA, cosA, x, y);
    ctx.fillStyle = COLORS[e.type as 'beetle' | 'spider'];
    if (e.type === 'beetle') {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.8, r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(0, r);
      ctx.stroke();
    } else {
      // Spider — 8 legs rotated with body
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS[e.type as 'beetle' | 'spider'];
      ctx.lineWidth = 0.8;
      for (let leg = 0; leg < 8; leg++) {
        const a = (leg / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3);
        ctx.stroke();
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // HP bar
    if (e.hp < e.maxHp) {
      const bw = CELL * 1.2;
      const bh = 2;
      const bx = x - bw / 2;
      const by = y - r - 5;
      ctx.fillStyle = '#500';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#f50';
      ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), bh);
    }
  },

  drawNestMarker(): void {
    if (!ctx) return;
    const x = STATE.nestCol * CELL + CELL / 2;
    const y = STATE.nestRow * CELL + CELL / 2;
    ctx.strokeStyle = 'rgba(200,100,220,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, CELL * 2.5, 0, Math.PI * 2);
    ctx.stroke();
  },

  render(): void {
    this.drawMap();
    this.drawNestMarker();
    for (const e of STATE.enemies) this.drawEnemy(e);

    const fog = STATE.fog;
    _antennaBuf.clear();

    for (const ant of STATE.ants) {
      if (ant._carried) continue;
      // Fog culling — skip ants in fully hidden cells
      if (fog) {
        const col = Math.round(ant.col);
        const row = Math.round(ant.row);
        if (STATE.inBounds(col, row) && fog[STATE.idx(col, row)] <= 0) continue;
      }
      this.drawAnt(ant, _antennaBuf);
    }

    // Batch antenna strokes — one stroke() per ant type instead of one per ant
    if (ctx) {
      ctx.lineWidth = 0.8;
      for (const [color, pts] of _antennaBuf) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i += 4) {
          ctx.moveTo(pts[i], pts[i + 1]);
          ctx.lineTo(pts[i + 2], pts[i + 3]);
        }
        ctx.stroke();
      }
    }
  },
};
