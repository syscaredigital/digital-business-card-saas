const fs = require("fs");
const path = require("path");
const pool = require("./config/database.config");

async function seedSuperAdmin() {
  const client = await pool.connect();
  try {
    const rolesSqlPath = path.resolve(
      __dirname,
      "../database/seeders/roles.seed.sql"
    );
    const superAdminSqlPath = path.resolve(
      __dirname,
      "../database/seeders/super_admin.seed.sql"
    );
    const rolesSql = fs.readFileSync(rolesSqlPath, "utf8");
    const superAdminSql = fs.readFileSync(superAdminSqlPath, "utf8");

    await client.query("BEGIN");
    await client.query(rolesSql);
    const result = await client.query(superAdminSql);
    if (result.rowCount !== 1) {
      throw new Error("The super-admin record was not created.");
    }
    await client.query("COMMIT");
    console.log("Super-admin account seeded successfully.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Failed to seed super-admin account:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedSuperAdmin();
