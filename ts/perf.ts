// Dirty global perf counters — accumulated per second, dumped to console.
// Access via window.PERF in DevTools.
export const PERF = {
    _last: 0,
    values: null as any,

    measure(key: string, fn: () => void): number {
        const t = performance.now();
        fn();
        const elapsed = performance.now() - t;
        (this as any).values ||= {};
        const values = this.values;
        const keyTime = key + '_time';
        const keyCalls = key + '_calls';
        values.hasOwnProperty(keyTime)
            ? values[keyTime] += elapsed
            : values[keyTime] = elapsed;
        values.hasOwnProperty(keyCalls)
            ? values[keyCalls]++
            : values[keyCalls] = 1;
        return elapsed;
    },

    flush(): void {
        const now = performance.now();
        if (this._last === 0) { this._last = now; return; }
        if (now - this._last < 1000) return;
        this._last = now;

        const values = this.values;
        if (values) {
            console.log(Object.keys(values).map(x => `${x}: ${values[x].toFixed(1)}; `).join(''))
        }
        this.values = null;
    },
};

(window as any).PERF = PERF;
