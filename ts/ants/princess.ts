import { CONFIG } from '../config';
import { STATE, Ant } from '../state';
import { STATS } from '../stats';
import { reveal } from '../ant';
import { requestPath, followPath } from '../path';
import { MapModule } from '../map';

export function startFlight(): boolean {
    if (STATE.flightStarted) return false;
    const eligible = STATE.ants.filter(
        a => a.type === 'princess' && a.lifestage === null && a.state === 'wander'
    );
    if (eligible.length < CONFIG.PRINCESS_LIMIT) return false;
    STATE.flightTotal = eligible.length;
    STATE.flightStarted = true;
    for (const ant of eligible) {
        ant.wanderTimer = -(Math.floor(Math.random() * 120));
        const exitAngle = -Math.random() * Math.PI;
        const exitR = CONFIG.PRINCESS_EXIT_RADIUS * Math.sqrt(Math.random());
        ant.targetCol = Math.max(0, Math.min(CONFIG.COLS - 1,
            Math.round(STATE.nestCol + exitR * Math.cos(exitAngle))));
        ant.targetRow = Math.max(0, Math.min(STATE.surfaceRows - 1,
            Math.round((STATE.surfaceRows - 1) + exitR * Math.sin(exitAngle))));
        ant.path = [];
        ant.state = 'surface';
    }
    return true;
}

export function updatePrincess(ant: Ant): void {
    reveal(ant);

    // ── WANDER: underground roaming ───────────────────────────────────────────
    if (ant.state === 'wander') {
        // Normal underground wander
        if (ant.wanderTimer-- <= 0) {
            ant.wanderTimer = 80 + Math.floor(Math.random() * 240);
            const floorOffset = CONFIG.CHAMBERS_PER_FLOOR + 1;
            const bottomChambers = STATE.chamberPositions.slice(floorOffset);
            if (bottomChambers.length > 0) {
                // Find current chamber (nearest by distance)
                const sorted = [...bottomChambers].sort((a, b) =>
                    (Math.abs(a.col - ant.col) + Math.abs(a.row - ant.row)) -
                    (Math.abs(b.col - ant.col) + Math.abs(b.row - ant.row))
                );
                const r = Math.random();
                let target: typeof sorted[0];
                if (r < 0.6) {
                    // 60%: same chamber
                    target = sorted[0];
                } else if (r < 0.9) {
                    // 30%: adjacent chamber (one of the 3 nearest others)
                    const adjacent = sorted.slice(1, 4);
                    target = adjacent[Math.floor(Math.random() * adjacent.length)];
                } else {
                    // 10%: any random chamber
                    target = bottomChambers[Math.floor(Math.random() * bottomChambers.length)];
                }
                const tc = target.col + Math.floor(Math.random() * 3) - 1;
                const tr = target.row + Math.floor(Math.random() * 3) - 1;
                if (STATE.inBounds(tc, tr) && MapModule.isPassable(tc, tr)) {
                    requestPath(ant, tc, tr);
                }
            }
        } else {
            followPath(ant);
        }
        return;
    }

    // ── SURFACE: walk to surface exit point ───────────────────────────────────
    if (ant.state === 'surface') {
        // Stagger delay
        if (ant.wanderTimer < 0) { ant.wanderTimer++; return; }
        // Walk to surface exit
        if (ant.path.length === 0) {
            requestPath(ant, ant.targetCol!, ant.targetRow!);
        }
        if (ant.path.length > 0) followPath(ant);
        // Arrived?
        const onSurface = ant.row < STATE.surfaceRows + 0.5;
        const nearExit = Math.abs(ant.col - (ant.targetCol! + 0.5)) < 1.5
            && Math.abs(ant.row - (ant.targetRow! + 0.5)) < 1.5;
        if (onSurface && nearExit) {
            ant.path = [];
            ant.state = 'prepare';
            ant.wanderTimer = 0;
        }
        return;
    }

    // ── PREPARE: mill around on surface for ~2 seconds before liftoff ─────────
    if (ant.state === 'prepare') {
        ant.wanderTimer++;
        if (ant.wanderTimer <= CONFIG.PRINCESS_SURFACE_LINGER) {
            if (ant.path.length === 0) {
                const tc = Math.max(0, Math.min(CONFIG.COLS - 1,
                    Math.floor(ant.col) + Math.floor(Math.random() * 7) - 3));
                const tr = Math.max(0, Math.min(STATE.surfaceRows - 1,
                    Math.floor(ant.row) + Math.floor(Math.random() * 3) - 1));
                if (STATE.inBounds(tc, tr)) ant.path = [[tc, tr]];
            } else {
                followPath(ant);
            }
            return;
        }
        // Linger done → liftoff
        ant.path = [];
        ant.state = 'fly';
        ant.wanderTimer = 0;
        ant.targetCol = ant.col
        ant.targetRow = ant.row
        return;
    }

    // ── FLY: wings open, spiral outward and up — mirror of intro spiral ──────
    if (ant.state === 'fly') {
        ant.wanderTimer++;
        const n = ant.wanderTimer;
        const t = n / CONFIG.UPS;   // seconds elapsed

        const baseX = (ant.targetCol ?? STATE.nestCol) + 0.5;
        const baseY = (ant.targetRow ?? STATE.surfaceRows - 1) + 0.5;

        // Each ant gets a unique starting angle via golden-angle distribution
        const a0 = ((baseX + baseY) * 2.399963229) % Math.PI * 0.8 + Math.PI * 0.1;

        // Mirror of intro spiral: radius grows from 0 (intro shrinks to 0)
        const spiral = (tt: number): { x: number; y: number } => {
            const ts = Math.min(tt / 4, 1);
            const r = 5.0 * Math.pow(ts, 0.8);
            const a = a0 + Math.PI * 4 * ts * ((baseX + baseY) % 2 - 1);
            const rAway = Math.pow(Math.max(0, tt - 1.0), 2) * 4.0;
            return { x: baseX + rAway * Math.cos(a0) + r * Math.cos(a), y: baseY - rAway * Math.sin(a0) + r * Math.sin(a) };
        };

        const pos = spiral(t);
        const fwd = spiral(t + 0.008);
        // renderer adds +π/2, so ant.angle = atan2(dy,dx) gives correct facing
        const rot = Math.atan2(fwd.y - pos.y, fwd.x - pos.x);

        ant.col = pos.x;
        ant.row = pos.y;
        ant.angle = rot;

        if (ant.row < -3 || ant.row > CONFIG.ROWS + 3
            || ant.col < -3 || ant.col > CONFIG.COLS + 3) {
            // Will be counted with died
            //STATE.flightEscaped++;
            STATS.totalPrincessesFled++;
            ant.hp = 0;
        }
    }
}
