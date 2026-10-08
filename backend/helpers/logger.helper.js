// Allowlisted fields only: never serialize request bodies, headers or errors.
function write(level, event, fields = {}) {
  const record = { timestamp: new Date().toISOString(), level, event };
  for (const key of ['requestId', 'method', 'path', 'status', 'userId', 'errorCode', 'durationMs']) {
    if (fields[key] !== undefined) record[key] = fields[key];
  }
  (level === 'error' ? console.error : console.log)(JSON.stringify(record));
}
module.exports = { write };
