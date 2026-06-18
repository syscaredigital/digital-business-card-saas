require("dotenv").config();
const pool = require("./config/database.config");

async function testDB() {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("Database Connected:", result.rows[0]);
    process.exit(0);
  } catch (error) {
    console.error("Database connection failed:", error.message || error);
    process.exit(1);
  }
}

testDB();
