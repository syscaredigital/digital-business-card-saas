const path = require('path');
const pool = require('../backend/config/database.config');
const { migrate } = require('./migrate');
const filename = process.argv[2] || '';
(async () => {
  let client;
  try {
    if (path.basename(filename) !== filename || !/^\d{3}_[a-z0-9_-]+\.sql$/i.test(filename)) throw new Error('Supply a migration filename');
    client = await pool.connect();
    await migrate(client, { only: filename });
    console.log('Migration verified/applied: ' + filename);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { if (client) client.release(); await pool.end(); }
})();
