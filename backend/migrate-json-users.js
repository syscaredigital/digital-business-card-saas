const fs = require("fs");
const path = require("path");
const pool = require("./config/database.config");

async function migrateJsonUsers() {
  const client = await pool.connect();
  try {
    const usersPath = path.resolve(__dirname, "data/users.json");
    const users = JSON.parse(fs.readFileSync(usersPath, "utf8"));

    await client.query("BEGIN");
    let imported = 0;

    for (const user of users) {
      const email = String(user.email || "").toLowerCase().trim();
      if (!email || !user.password) continue;

      const roleResult = await client.query(
        "SELECT id FROM roles WHERE name = $1 LIMIT 1",
        [user.role || "user"]
      );
      if (!roleResult.rowCount) {
        throw new Error(`Role '${user.role || "user"}' is missing.`);
      }

      let companyId = null;
      if (user.companyName) {
        const existingCompany = await client.query(
          "SELECT id FROM companies WHERE LOWER(name) = LOWER($1) LIMIT 1",
          [user.companyName]
        );
        if (existingCompany.rowCount) {
          companyId = existingCompany.rows[0].id;
        } else {
          const companyResult = await client.query(
            "INSERT INTO companies (name, email) VALUES ($1, $2) RETURNING id",
            [user.companyName, email]
          );
          companyId = companyResult.rows[0].id;
        }
      }

      const result = await client.query(
        `INSERT INTO users
           (company_id, role_id, name, email, password, phone, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, NOW())
         ON CONFLICT (email) DO NOTHING`,
        [
          companyId,
          roleResult.rows[0].id,
          `${user.firstName || ""} ${user.lastName || ""}`.trim() || email,
          email,
          user.password,
          user.phoneNumber || null,
          user.createdAt || new Date().toISOString(),
        ]
      );
      imported += result.rowCount;
    }

    await client.query("COMMIT");
    console.log(`Imported ${imported} JSON user account(s) into PostgreSQL.`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Failed to migrate JSON users:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateJsonUsers();
