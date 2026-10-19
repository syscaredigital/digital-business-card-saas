const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pool = require('../backend/config/database.config');

test('Classic retirement preserves cards and plan restrictions without relying on template IDs', async () => {
  let client;
  try {
    assert.ok(['localhost', '127.0.0.1', '::1'].includes(pool.options.host));
    assert.notEqual(process.env.NODE_ENV, 'production');
    client = await pool.connect();
    // All fixtures are connection-local; the migration cannot reach business tables.
    await client.query('SET search_path TO pg_temp');
    await client.query('CREATE TEMP TABLE vcard_templates(id INTEGER PRIMARY KEY,template_json JSONB)');
    await client.query('CREATE TEMP TABLE vcards(id INTEGER PRIMARY KEY,template_id INTEGER REFERENCES vcard_templates(id),updated_at TIMESTAMPTZ)');
    await client.query('CREATE TEMP TABLE plans(id INTEGER PRIMARY KEY,features JSONB)');
    const themes = ['automotive', 'corporate', 'events', 'trainer', 'property', 'boutique', 'creative', 'technology', 'medical', 'legal'];
    for (const [index, theme] of themes.entries()) {
      await client.query('INSERT INTO vcard_templates VALUES($1,$2::jsonb),($3,$4::jsonb)', [index + 1, JSON.stringify({ designKey: theme }), index + 101, JSON.stringify({ designKey: theme + '-classic' })]);
      await client.query('INSERT INTO vcards(id,template_id) VALUES($1,$1)', [index + 1]);
    }
    await client.query("INSERT INTO vcard_templates VALUES(50,'{}'); INSERT INTO vcards(id,template_id) VALUES(50,50)");
    await client.query(`INSERT INTO plans VALUES
      (1,'{"templateIds":[1,101,2],"benefits":["Keep me"]}'),
      (2,'{"templateIds":[50]}'),(3,'[]'),(4,'{"templateIds":null}'),(5,'{"templateIds":[]}')`);
    const source = fs.readFileSync(path.join(__dirname, '../database/migrations/078_keep_classic_templates_only.sql'), 'utf8');
    await client.query(source);
    const cards = (await client.query('SELECT id,template_id FROM vcards ORDER BY id')).rows;
    for (const card of cards) assert.equal(card.template_id, card.id === 50 ? 102 : card.id + 100);
    assert.equal((await client.query('SELECT COUNT(*)::int count FROM vcard_templates')).rows[0].count, 10);
    assert.deepEqual((await client.query('SELECT features FROM plans ORDER BY id')).rows.map(row => row.features), [
      { templateIds: [101, 102], benefits: ['Keep me'] }, { templateIds: [102] }, [], { templateIds: null }, { templateIds: [] }
    ]);
  } finally {
    if (client) { await client.query('ROLLBACK'); client.release(); }
    await pool.end();
  }
});
