const logger = require('../helpers/logger.helper');

module.exports = function errorHandler(err, req, res, next) {
  logger.write('error', 'http.error', {
    requestId: req.requestId, method: req.method,
    path: req.originalUrl.split('?')[0], userId: req.user?.id,
    errorCode: err.code || err.name
  });
  if (res.headersSent) return next(err);
  if (err.name === 'MulterError') {
    return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE'
      ? 'Payment slip must be 5 MB or smaller' : 'Unable to upload the payment slip' });
  }
  const proposed = Number(err.status || err.statusCode || 500);
  const status = Number.isInteger(proposed) && proposed >= 400 && proposed <= 599 ? proposed : 500;
  res.status(status).json({ message: status >= 500 && process.env.NODE_ENV === 'production'
    ? 'The request could not be completed. Please try again later.'
    : err.publicMessage || err.message || 'Internal Server Error' });
};
