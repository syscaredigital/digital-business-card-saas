const crypto = require('crypto');
const pool = require('../config/database.config');

// Atomic PostgreSQL buckets are shared across workers and survive app restarts.
module.exports = function rateLimit({ limit = 30, windowMs = 15 * 60 * 1000, scope = 'auth' } = {}) {
  return async (req, res, next) => {
    try {
      const key = crypto.createHash('sha256').update(scope + ':' + req.ip).digest('hex');
      const result = await pool.query(`INSERT INTO rate_limit_buckets(bucket_key,attempts,expires_at)
        VALUES($1,1,NOW()+$2*INTERVAL '1 millisecond')
        ON CONFLICT(bucket_key) DO UPDATE SET
          attempts=CASE WHEN rate_limit_buckets.expires_at<=NOW() THEN 1 ELSE LEAST(rate_limit_buckets.attempts+1,$3+1) END,
          expires_at=CASE WHEN rate_limit_buckets.expires_at<=NOW() THEN EXCLUDED.expires_at ELSE rate_limit_buckets.expires_at END
        RETURNING attempts,GREATEST(1,CEIL(EXTRACT(EPOCH FROM (expires_at-NOW()))))::int AS retry_after`, [key,windowMs,limit]);
      if (result.rows[0].attempts > limit) {
        res.set('Retry-After',String(result.rows[0].retry_after));
        return res.status(429).json({ message: 'Too many requests. Please try again later.' });
      }
      next();
    } catch (error) { next(error); } // Fail closed if the shared store is unavailable.
  };
};
