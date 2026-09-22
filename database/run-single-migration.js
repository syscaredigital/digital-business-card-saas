const fs = require("fs");
const path = require("path");
const pool = require("../backend/config/database.config");

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
