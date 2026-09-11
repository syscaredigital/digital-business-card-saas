function validateRegistration(req, res, next) {
  const body = req.body || {};
  if (typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) return res.status(400).json({ message: 'Enter a valid email address.' });
  if (typeof body.password !== 'string' || body.password.length < 12 || Buffer.byteLength(body.password) > 72) return res.status(400).json({ message: 'Use a password of at least 12 characters and no more than 72 bytes.' });
  for (const key of ['firstName', 'lastName']) if (typeof body[key] !== 'string' || !body[key].trim() || body[key].length > 100) return res.status(400).json({ message: 'Enter your first and last name (up to 100 characters each).' });
  for (const key of ['phoneNumber', 'companyName']) if (body[key] != null && (typeof body[key] !== 'string' || body[key].length > 255)) return res.status(400).json({ message: 'Contact information is too long.' });
  next();
}
function validateLogin(req, res, next) {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || !email.trim() || email.length > 254 || typeof password !== 'string' || !password || Buffer.byteLength(password) > 72) return res.status(400).json({ message: 'Enter your email and password.' });
  next();
}
module.exports = { validateRegistration, validateLogin };
