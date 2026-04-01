import { CONFIG } from './config';

/**
 * Spatial hash index for food cells.
 * Wraps a Set<number> (cell indices) and maintains a grid of buckets
 * for O(1) nearest-neighbor lookups instead of O(n) full scans.
 *
 * Bucket size = BUCKET cells. Each bucket stores a Set of cell indices.
 * The class is iterable (delegates to the underlying Set) so it can be
 * used as a drop-in replacement for `Set<number>` in iteration contexts.
 */

const BUCKET = 8;

export class FoodSpatialIndex implements Iterable<number> {
    private _set = new Set<number>();
    private _bucketCols: number;
    private _bucketRows: number;
    private _buckets: Set<number>[];

    constructor() {
        this._bucketCols = Math.ceil(CONFIG.COLS / BUCKET);
        this._bucketRows = Math.ceil(CONFIG.ROWS / BUCKET);
        this._buckets = new Array(this._bucketCols * this._bucketRows);
        for (let i = 0; i < this._buckets.length; i++) {
            this._buckets[i] = new Set();
        }
    }

    get size(): number { return this._set.size; }

    private _bucketIdx(col: number, row: number): number {
        const bc = (col / BUCKET) | 0;
        const br = (row / BUCKET) | 0;
        return br * this._bucketCols + bc;
    }

    add(cellIdx: number): void {
        if (this._set.has(cellIdx)) return;
        this._set.add(cellIdx);
        const col = cellIdx % CONFIG.COLS;
        const row = (cellIdx / CONFIG.COLS) | 0;
        this._buckets[this._bucketIdx(col, row)].add(cellIdx);
    }

    delete(cellIdx: number): void {
        if (!this._set.has(cellIdx)) return;
        this._set.delete(cellIdx);
        const col = cellIdx % CONFIG.COLS;
        const row = (cellIdx / CONFIG.COLS) | 0;
        this._buckets[this._bucketIdx(col, row)].delete(cellIdx);
    }

    has(cellIdx: number): boolean {
        return this._set.has(cellIdx);
    }

    clear(): void {
        this._set.clear();
        for (const b of this._buckets) b.clear();
    }

    [Symbol.iterator](): Iterator<number> {
        return this._set[Symbol.iterator]();
    }

    /**
     * Find the nearest food cell to (refCol, refRow) that passes the filter.
     * Searches outward from the reference bucket in expanding rings.
     * Returns [col, row] or null if no visible food found.
     */
    findNearest(
        refCol: number,
        refRow: number,
        filter: (cellIdx: number, col: number, row: number) => boolean,
    ): [number, number] | null {
        const bc0 = Math.max(0, Math.min(this._bucketCols - 1, (refCol / BUCKET) | 0));
        const br0 = Math.max(0, Math.min(this._bucketRows - 1, (refRow / BUCKET) | 0));

        let bestDist = Infinity;
        let bestCol = -1;
        let bestRow = -1;

        // Search expanding rings of buckets. Once we've found a candidate
        // and the ring's minimum possible distance exceeds bestDist, stop.
        const maxRing = Math.max(this._bucketCols, this._bucketRows);
        for (let ring = 0; ring < maxRing; ring++) {
            // Minimum distance from any cell in this ring to the reference point
            const ringMinDist = ring > 0 ? (ring - 1) * BUCKET : 0;
            if (ringMinDist > bestDist) break;

            // Iterate all buckets in this ring (perimeter of the square)
            const rMin = br0 - ring, rMax = br0 + ring;
            const cMin = bc0 - ring, cMax = bc0 + ring;

            for (let br = rMin; br <= rMax; br++) {
                if (br < 0 || br >= this._bucketRows) continue;
                for (let bc = cMin; bc <= cMax; bc++) {
                    if (bc < 0 || bc >= this._bucketCols) continue;
                    // Only process perimeter cells (skip interior — already processed)
                    if (ring > 0 && br > rMin && br < rMax && bc > cMin && bc < cMax) continue;

                    const bucket = this._buckets[br * this._bucketCols + bc];
                    if (bucket.size === 0) continue;

                    for (const cellIdx of bucket) {
                        const c = cellIdx % CONFIG.COLS;
                        const r = (cellIdx / CONFIG.COLS) | 0;
                        if (!filter(cellIdx, c, r)) continue;
                        const dx = c + 0.5 - refCol;
                        const dy = r + 0.5 - refRow;
                        const d = Math.sqrt(dx * dx + dy * dy);
                        if (d < bestDist) {
                            bestDist = d;
                            bestCol = c;
                            bestRow = r;
                        }
                    }
                }
            }
        }

        return bestCol >= 0 ? [bestCol, bestRow] : null;
    }
}
