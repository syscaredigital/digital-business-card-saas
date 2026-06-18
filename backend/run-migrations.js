require("dotenv").config();
const pool = require("./config/database.config");
const fs = require("fs");
const path = require("path");

async function runMigrations() {
  const migrationsDir = path.join(__dirname, "..", "database", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`\n📦 Found ${files.length} migration files\n`);

  for (const file of files) {
    try {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf8").trim();

      console.log(`⏳ Running ${file}...`);
      await pool.query(sql);
      console.log(`✅ ${file} completed`);
    } catch (error) {
      console.error(`❌ Error in ${file}:`, error.message);
      process.exit(1);
    }
  }

  console.log("\n✅ All migrations completed successfully!");
  process.exit(0);
}

runMigrations();
