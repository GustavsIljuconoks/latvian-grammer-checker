/** Fixed-window limit per key. In memory, so it resets on restart and isn't shared between processes. */
export function createRateLimiter(limit: number, windowMs: number, now = Date.now) {
  const windows = new Map<string, { start: number; count: number }>();
  return {
    /** Counts one hit; false when the key is over the limit. */
    hit(key: string): boolean {
      const t = now();
      if (windows.size > 10_000) for (const [k, v] of windows) if (t - v.start >= windowMs) windows.delete(k);
      const w = windows.get(key);
      if (!w || t - w.start >= windowMs) {
        windows.set(key, { start: t, count: 1 });
        return true;
      }
      w.count++;
      return w.count <= limit;
    },
  };
}
