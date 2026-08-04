const fs = require("fs");
const path = require("path");
const { Pool } = require("../backend/node_modules/pg");

require("../backend/node_modules/dotenv").config({
  path: path.resolve(__dirname, "../backend/.env"),
});

const filename = path.basename(process.argv[2] || "");
if (!/^\d{3}_[a-z0-9_-]+\.sql$/i.test(filename)) {
  console.error("Usage: node database/run-single-migration.js 050_migration_name.sql");
  process.exit(1);
}

const migrationPath = path.resolve(__dirname, "migrations", filename);
if (!fs.existsSync(migrationPath)) {
  console.error(`Migration not found: ${filename}`);
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

(async () => {
  try {
    await pool.query(fs.readFileSync(migrationPath, "utf8"));
    console.log(`Applied ${filename}`);
  } catch (error) {
    console.error(`Migration failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
