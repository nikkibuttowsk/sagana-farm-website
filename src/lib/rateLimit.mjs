const hits = new Map();

export function rateLimit(key, { limit = 5, windowMs = 60_000 } = {}) {
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);

    if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
    }

    recent.push(now);
    hits.set(key, recent);

    if (hits.size > 5000) {
        for (const [k, times] of hits) {
        if (!times.some((t) => now - t < windowMs)) hits.delete(k);
        }
    }

    return true;
}