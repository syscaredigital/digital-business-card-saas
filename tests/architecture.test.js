const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseAppointment } = require('../backend/validators/appointment.validator');

function client(fetch) {
  const window = { location: { origin: 'https://cards.test', href: 'https://cards.test/vcard/alex' }, fetch };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../frontend/public/assets/js/vcard-public-api.js'), 'utf8'), { window, URL });
  return window.SyncVCardPublicApi;
}

test('public client enforces credential omission and only accepts the configured public API', async () => {
  const calls = [];
  const api = client(async (url, options) => { calls.push({ url, options }); return new Response('{"message":"Saved"}'); });
  await api.request('https://cards.test/api/public/vcards/1/events', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.body, '{}');
  await assert.rejects(api.request('https://other.test/api/public/contact'), /Unexpected public API/);
  await assert.rejects(api.request('https://cards.test/api/user/vcards'), /Unexpected public API/);
  assert.equal(calls.length, 1);
});

test('public client preserves actionable validation but masks server and origin errors', async () => {
  await assert.rejects(client(async () => new Response('{"message":"Choose a valid service"}', { status: 400 })).request('/api/public/test'), /Choose a valid service/);
  await assert.rejects(client(async () => new Response('{"message":"database password"}', { status: 500 })).request('/api/public/test'), /temporarily unavailable/);
  await assert.rejects(client(async () => new Response('{"message":"Invalid browser request origin"}', { status: 403 })).request('/api/public/test'), /Refresh the page/);
  await assert.rejects(client(async () => new Response('<html>proxy failed</html>', { status: 502 })).request('/api/public/test'), /unexpected response/);
  await assert.rejects(client(async () => { throw Error('private details'); }).request('/api/public/test'), /Check your connection/);
});

test('appointment validator rejects malformed and oversized values before persistence', () => {
  const body = { name: 'Visitor', email: 'visitor@example.test', appointmentType: 'online', startsAt: '2099-01-01T10:00:00Z' };
  assert.ok(parseAppointment(body).value);
  for (const override of [{ name: {} }, { email: 'bad' }, { phone: '1'.repeat(51) }, { notes: 'a'.repeat(2001) }, { startsAt: 'invalid' }, { startsAt: '2000-01-01' }, { appointmentType: 'unsupported' }]) {
    assert.ok(parseAppointment({ ...body, ...override }).error);
  }
});

test('structured logger excludes arbitrary sensitive fields', () => {
  const logger = require('../backend/helpers/logger.helper');
  const original = console.log;
  let record;
  try {
    console.log = value => { record = JSON.parse(value); };
    logger.write('info', 'test', { requestId: 'safe-id', body: { password: 'secret' }, cookie: 'secret', token: 'secret' });
  } finally { console.log = original; }
  assert.equal(record.requestId, 'safe-id');
  assert.doesNotMatch(JSON.stringify(record), /secret|password|cookie|token/);
});

test('global error handler masks internal production errors and delegates after headers', () => {
  const handler = require('../backend/middlewares/error.middleware');
  const env = process.env.NODE_ENV, original = console.error;
  let body, status;
  try {
    process.env.NODE_ENV = 'production'; console.error = () => {};
    const req = { originalUrl: '/api/test?token=secret', method: 'GET', requestId: 'test' };
    const res = { status(value) { status = value; return this; }, json(value) { body = value; } };
    handler(new Error('database credentials'), req, res, () => assert.fail());
    assert.equal(status, 500); assert.doesNotMatch(body.message, /database|credentials/);
    let delegated = false;
    handler(new Error('stream'), req, { headersSent: true }, () => { delegated = true; });
    assert.ok(delegated);
  } finally { if (env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = env; console.error = original; }
});
