require("dotenv").config();
const pool = require("./config/database.config");

async function checkTables() {
  try {
    const result = await pool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;"
    );
    
    console.log("\n✅ Database Connected");
    console.log(`\nTotal Tables Created: ${result.rows.length}\n`);
    console.log("Tables in database:");
    result.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.tablename}`);
    });
    
    // Expected 23 tables based on migrations
    if (result.rows.length === 23) {
      console.log("\n✅ All 23 tables are present!");
    } else {
      console.log(`\n⚠️  Expected 23 tables but found ${result.rows.length}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Error checking tables:", error.message);
    process.exit(1);
  }
}

checkTables();
