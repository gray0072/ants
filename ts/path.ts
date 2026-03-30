import { CONFIG } from './config';
import { STATE, Mover } from './state';
import { MapModule } from './map';
import { PERF } from './perf';

// Static BFS buffers — reused across all findPath calls to avoid per-call allocations
const _bfsParent = new Int32Array(CONFIG.COLS * CONFIG.ROWS);
const _bfsQueue = new Int32Array(CONFIG.COLS * CONFIG.ROWS);
const _bfsDirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// ---------------------------------------------------------------------------
// Path cache — only for MapModule.isPassable (symmetric, stable across digs)
// Key: startIdx * GRID_SIZE + endIdx
// ---------------------------------------------------------------------------

const GRID_SIZE = CONFIG.COLS * CONFIG.ROWS;
type PathResult = [number, number][] | null;
const _pathCache = new Map<number, PathResult>();

function _packKey(si: number, ei: number): number { return si * GRID_SIZE + ei; }

// B→A from cached A→B:
//   original: [B, c_{n-1}, ..., c_1]  (path[last] = first step from A)
//   reversed: [A, c_1, ..., c_{n-1}]  (path[last] = first step from B)
function _reversePath(path: [number, number][], fc: number, fr: number): [number, number][] {
    const rev: [number, number][] = [[fc, fr]];
    for (let i = path.length - 1; i >= 1; i--) rev.push(path[i]);
    return rev;
}

export function invalidatePathCache(): void { _pathCache.clear(); }

// Called by MapModule.expandSurface() — shifts all cached row indices down by delta.
export function shiftPathCache(delta: number): void {
    const { COLS, ROWS } = CONFIG;
    const entries = Array.from(_pathCache.entries());
    _pathCache.clear();
    for (const [key, path] of entries) {
        const si = (key / GRID_SIZE) | 0;
        const ei = key % GRID_SIZE;
        const newSr = (si / COLS | 0) + delta;
        const newEr = (ei / COLS | 0) + delta;
        if (newSr >= ROWS || newEr >= ROWS) continue;
        const newSi = newSr * COLS + (si % COLS);
        const newEi = newEr * COLS + (ei % COLS);
        _pathCache.set(_packKey(newSi, newEi),
            path === null ? null : path.map(([c, r]) => [c, r + delta]));
    }
}

// BFS pathfinding with parent pointers — avoids O(path_length) allocations per node
// Returns path with first step at the END (use path.pop() to consume steps)
function findPath(fc: number, fr: number, tc: number, tr: number, passableFn: (c: number, r: number) => boolean): [number, number][] | null {
    if (fc === tc && fr === tr) return [];
    const { COLS, ROWS } = CONFIG;
    const startIdx = fr * COLS + fc;
    const endIdx = tr * COLS + tc;

    const cacheable = passableFn === MapModule.isPassable;
    if (cacheable) {
        const fwdKey = _packKey(startIdx, endIdx);
        if (_pathCache.has(fwdKey)) {
            const cached = _pathCache.get(fwdKey)!;
            return cached ? cached.slice() : null;
        }
        const revKey = _packKey(endIdx, startIdx);
        if (_pathCache.has(revKey)) {
            const cached = _pathCache.get(revKey)!;
            if (cached === null) { _pathCache.set(fwdKey, null); return null; }
            const rev = _reversePath(cached, fc, fr);
            _pathCache.set(fwdKey, rev);
            return rev.slice();
        }
    }

    _bfsParent.fill(-1);
    _bfsParent[startIdx] = startIdx;

    let head = 0, tail = 0;
    _bfsQueue[tail++] = startIdx;

    let iter = 0;
    while (head < tail && iter++ < 20000) {
        const cur = _bfsQueue[head++];
        const c = cur % COLS;
        const r = (cur / COLS) | 0;
        for (const [dc, dr] of _bfsDirs) {
            const nc = c + dc, nr = r + dr;
            if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
            const ni = nr * COLS + nc;
            if (_bfsParent[ni] !== -1) continue;
            if (!passableFn(nc, nr)) continue;
            _bfsParent[ni] = cur;
            if (ni === endIdx) {
                // Reconstruct path backwards — first step ends up at path[path.length-1]
                const path: [number, number][] = [];
                let idx = endIdx;
                while (idx !== startIdx) {
                    path.push([idx % COLS, (idx / COLS) | 0]);
                    idx = _bfsParent[idx];
                }
                if (cacheable) _pathCache.set(_packKey(startIdx, endIdx), path);
                return path.slice();
            }
            _bfsQueue[tail++] = ni;
        }
    }
    if (cacheable) _pathCache.set(_packKey(startIdx, endIdx), null);
    return null;
}

export function stepToward(mover: Mover, tc: number, tr: number): boolean {
    const dx = (tc + 0.5) - mover.col;
    const dy = (tr + 0.5) - mover.row;
    const d = Math.hypot(dx, dy);
    if (d < 0.1) return true; // arrived
    mover.angle = Math.atan2(dy, dx);
    mover.col += (dx / d) * mover.speed;
    mover.row += (dy / d) * mover.speed;
    return d < mover.speed + 0.1;
}

export function followPath(mover: Mover): boolean {
    if (!mover.path || mover.path.length === 0) return true;
    const [tc, tr] = mover.path[mover.path.length - 1];
    if (stepToward(mover, tc, tr)) {
        mover.path.pop();
    }
    return mover.path.length === 0;
}

// On surface both ends are open — skip BFS and go straight.
// Underground → surface: BFS to tunnel exit, then straight to target.
export function requestPath(mover: Mover, tc: number, tr: number): void {
    mover.targetCol = tc;
    mover.targetRow = tr;

    const moverCol = Math.floor(mover.col);
    const moverRow = Math.floor(mover.row);
    const moverOnSurface = moverRow < STATE.surfaceRows;
    const tgtOnSurface = tr < STATE.surfaceRows;
    if (moverOnSurface && tgtOnSurface) {
        mover.path = [[tc, tr]];
        return;
    }
    const entryC = STATE.nestCol;
    const entryR = STATE.surfaceRows - 1;
    const isPassableFn = (c, r) => r >= entryR && MapModule.isPassable(c, r);
    if (!moverOnSurface && tgtOnSurface) {
        // BFS underground to tunnel exit, then straight on surface to target
        const bfsPath = findPath(moverCol, moverRow, entryC, entryR, isPassableFn);
        if (bfsPath) {
            // bfsPath[last] = first step (popped first), bfsPath[0] = exit cell
            // [tc, tr] at index 0 is consumed last — straight line from exit to target
            mover.path = [[tc, tr], ...bfsPath];
            return;
        }
    }
    if (moverOnSurface && !tgtOnSurface) {
        // Straight on surface to tunnel entrance, then BFS underground to target.
        // Restrict BFS to underground cells only (r >= surfaceRows) so it never
        // routes through surface cells and creates a zigzag.
        const surf = STATE.surfaceRows;
        const bfsPath = findPath(entryC, entryR, tc, tr, isPassableFn);
        if (bfsPath) {
            // [entryC, entryR] at the end is consumed first — straight line from ant to entrance
            mover.path = [...bfsPath, [entryC, entryR]];
            return;
        }
    }
    mover.path = findPath(moverCol, moverRow, tc, tr, isPassableFn) || [];
}
