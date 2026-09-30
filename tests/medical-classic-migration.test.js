const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pool = require('../backend/config/database.config');

test('medical catalogue migration preserves cards and restricted plans, and is repeatable', async () => {
  let client;
  try {
    assert.ok(['localhost','127.0.0.1','::1'].includes(pool.options.host), 'Use a local test database');
    assert.notEqual(process.env.NODE_ENV,'production');
    client = await pool.connect();
    // Session-local temporary tables shadow business tables; nothing is persisted.
    await client.query('BEGIN');
    await client.query('SET LOCAL search_path TO pg_temp');
    await client.query('CREATE TEMP TABLE vcard_templates (id SERIAL PRIMARY KEY,name TEXT,description TEXT,preview_url TEXT,template_json JSONB,is_public BOOLEAN) ON COMMIT DROP');
    await client.query('CREATE TEMP TABLE plans (id SERIAL PRIMARY KEY,features JSONB) ON COMMIT DROP');
    await client.query("INSERT INTO vcard_templates(name,template_json,is_public) VALUES ('Existing design','{}',TRUE)");
    await client.query(`INSERT INTO plans(features) VALUES ('{"templateIds":[1,4],"benefits":["Keep me"]}'), ('{"templateIds":[1]}'), ('[]'), ('{"templateIds":null}')`);
    const sql = fs.readFileSync(path.join(__dirname,'../database/migrations/076_add_medical_classic_template.sql'),'utf8').replace(/^\s*BEGIN;\s*/i,'').replace(/\s*COMMIT;\s*$/i,'');
    await client.query(sql);
    await client.query(sql);
    const templates = (await client.query('SELECT * FROM vcard_templates ORDER BY id')).rows;
    assert.equal(templates.length,2);
    assert.equal(templates[0].name,'Existing design');
    assert.equal(templates[1].template_json.designKey,'medical-classic');
    assert.ok(fs.existsSync(path.join(__dirname,'../frontend/pages/website',templates[1].preview_url)));
    const plans = (await client.query('SELECT features FROM plans ORDER BY id')).rows;
    assert.deepEqual(plans[0].features,{templateIds:[1,4,templates[1].id],benefits:['Keep me']});
    assert.deepEqual(plans[1].features,{templateIds:[1]});
    assert.deepEqual(plans[2].features,[]);
    assert.deepEqual(plans[3].features,{templateIds:null});
  } finally {
    if(client){await client.query('ROLLBACK');client.release();}
    await pool.end();
  }
});

