module.exports = function rateLimit({ limit = 30, windowMs = 15 * 60 * 1000 } = {}) {
  const entries = new Map();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of entries) if (value.until <= now) entries.delete(key);
    const key = req.ip;
    let value = entries.get(key);
    if (!value && entries.size < 10000) {
      value = { count: 0, until: now + windowMs };
      entries.set(key, value);
    }
    if (!value || ++value.count > limit) {
      res.set('Retry-After', String(Math.ceil(((value?.until || now + windowMs) - now) / 1000)));
      return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }
    next();
  };
};
