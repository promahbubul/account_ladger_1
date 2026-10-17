/**
 * Production-ready In-Memory Rate Limiter with Sliding Window Tracking
 * Provides IP-based and identifier-based abuse protection
 */
export function createRateLimiter({
  windowMs = 15 * 60 * 1000, // 15 minutes default
  maxAttempts = 5,
  message = 'Too many requests. Please try again later.',
  keyGenerator = (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown',
}) {
  const store = new Map(); // key -> Array of timestamps

  // Sweep stale entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of store.entries()) {
      const active = timestamps.filter((t) => now - t < windowMs);
      if (active.length === 0) {
        store.delete(key);
      } else {
        store.set(key, active);
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();
    const timestamps = (store.get(key) || []).filter((t) => now - t < windowMs);

    if (timestamps.length >= maxAttempts) {
      const oldest = timestamps[0];
      const retryAfterSeconds = Math.ceil((windowMs - (now - oldest)) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.status(429).json({
        error: message,
        retryAfter: retryAfterSeconds,
      });
      return;
    }

    timestamps.push(now);
    store.set(key, timestamps);
    next();
  };
}

// Pre-configured rate limiters
export const forgotPasswordRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 5,
  message: 'Too many password reset requests. Please wait before trying again.',
  keyGenerator: (req) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const email = req.body && req.body.email ? String(req.body.email).toLowerCase().trim() : '';
    return email ? `${ip}_${email}` : ip;
  },
});

export const resetPasswordRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 10,
  message: 'Too many password reset attempts. Please wait before trying again.',
  keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown',
});
