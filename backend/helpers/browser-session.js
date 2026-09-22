const jwt = require('jsonwebtoken');
const cookieName = () => process.env.NODE_ENV === 'production' ? '__Host-sync_session' : 'sync_session';
const options = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
function readToken(req) {
  const pair = String(req.get('cookie') || '').split(';').map(value => value.trim()).find(value => value.startsWith(cookieName() + '='));
  return pair ? pair.slice(cookieName().length + 1) : null;
}
function issue(req, res, token) {
  if (req.get('X-Session-Mode') !== 'cookie') return { token };
  if (token) res.cookie(cookieName(), token, { ...options(), maxAge: Math.max(0, jwt.decode(token).exp * 1000 - Date.now()) });
  return { authenticated: Boolean(token) };
}
function clear(res) { res.clearCookie(cookieName(), options()); }
function protect(req, res, next) {
  res.set('Cache-Control', 'no-store');
  if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();
  if (!readToken(req) && req.get('X-Session-Mode') !== 'cookie') return next();
  const allowed = [process.env.PUBLIC_APP_URL, ...(process.env.CORS_ORIGINS || '').split(',')].filter(Boolean).map(value => value.replace(/\/$/, ''));
  if (process.env.NODE_ENV !== 'production') {
    allowed.push(req.protocol + '://' + req.get('host'));
    for (const host of ['localhost','127.0.0.1','[::1]']) for (const port of [5000,5500,5501]) allowed.push(`http://${host}:${port}`);
  }
  if (req.get('X-Requested-With') !== 'SyncECard' || !allowed.includes(req.get('origin'))) {
    return res.status(403).json({ message: 'Invalid browser request origin' });
  }
  next();
}
module.exports = { readToken, issue, clear, protect };
