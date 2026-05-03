import { stmt } from '../db.js';

export function tokenBucket({ key, capacity, refillPerSec }) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const bucketKey = `${key}:${ip}`;
    const now = Date.now();

    const row = stmt.getRateBucket.get(bucketKey);
    let tokens = capacity;
    let last = now;
    if (row) {
      const elapsed = (now - row.updated_at) / 1000;
      tokens = Math.min(capacity, row.tokens + elapsed * refillPerSec);
      last = now;
    }

    if (tokens < 1) {
      const retry = Math.ceil((1 - tokens) / refillPerSec);
      res.set('Retry-After', String(retry));
      res.set('X-RateLimit-Remaining', '0');
      return res.status(429).json({
        error: 'rate_limited',
        retry_after_seconds: retry
      });
    }

    tokens -= 1;
    stmt.upsertRateBucket.run(bucketKey, tokens, last);
    res.set('X-RateLimit-Remaining', String(Math.floor(tokens)));
    res.set('X-RateLimit-Capacity', String(capacity));
    next();
  };
}
