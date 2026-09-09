// Per-process abuse protection. Use a shared edge limiter for multiple replicas.
const attempts = new Map();
module.exports = function recoveryRateLimit(req, res, next) {
  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
  const key = req.ip;
  let entry = attempts.get(key);
  if (!entry) {
    if (attempts.size >= 10000) return res.status(429).json({ message: "Please try again later." });
    entry = { count: 0, until: now + 15 * 60 * 1000 };
    attempts.set(key, entry);
  }
  if (++entry.count > 10) {
    res.set("Retry-After", String(Math.ceil((entry.until - now) / 1000)));
    return res.status(429).json({ message: "Too many recovery attempts. Please try again later." });
  }
  next();
};
