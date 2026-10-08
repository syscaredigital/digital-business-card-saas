const { randomUUID } = require('node:crypto');
const logger = require('../helpers/logger.helper');

module.exports = function requestLog(req, res, next) {
  req.requestId = randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  const started = process.hrtime.bigint();
  res.once('finish', () => logger.write('info', 'http.request', {
    requestId: req.requestId, method: req.method,
    path: req.originalUrl.split('?')[0], status: res.statusCode,
    userId: req.user?.id,
    durationMs: Math.round(Number(process.hrtime.bigint() - started) / 1e6)
  }));
  next();
};
