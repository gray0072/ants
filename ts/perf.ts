// Dirty global perf counters — accumulated per second, dumped to console.
// Access via window.PERF in DevTools.

interface PerfValues {
    [key: string]: number;
}

export const PERF = {
    _last: 0,
    values: null as PerfValues | null,

    measure(key: string, fn: () => void): number {
        const t = performance.now();
        fn();
        const elapsed = performance.now() - t;
        if (!this.values) this.values = {};
        const values = this.values;
        const keyTime = key + '_time';
        const keyCalls = key + '_calls';
        values[keyTime] = (values[keyTime] ?? 0) + elapsed;
        values[keyCalls] = (values[keyCalls] ?? 0) + 1;
        return elapsed;
    },

    flush(): void {
        const now = performance.now();
        if (this._last === 0) { this._last = now; return; }
        if (now - this._last < 1000) return;
        this._last = now;

        const values = this.values;
        if (values) {
            console.log(Object.keys(values).map(x => `${x}: ${values[x].toFixed(1)}; `).join(''));
        }
        this.values = null;
    },
};

(window as any).PERF = PERF;
