const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  return content.split(/\r?\n/).reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return acc;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) return acc;
    let key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (value.startsWith("\"") && value.endsWith("\"")) {
      value = value.slice(1, -1);
    }
    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    acc[key] = value;
    return acc;
  }, {});
}

function getEnv() {
  const rootEnvPath = path.resolve(__dirname, "..", "backend", ".env");
  return {
    ...process.env,
    ...loadEnvFile(rootEnvPath),
  };
}

function buildPgEnv(env) {
  return {
    ...env,
    PGHOST: env.PG_HOST || env.DB_HOST || env.PGHOST,
    PGPORT: env.PG_PORT || env.DB_PORT || env.PGPORT,
    PGDATABASE: env.PG_DATABASE || env.DB_NAME || env.PGDATABASE,
    PGUSER: env.PG_USER || env.DB_USER || env.PGUSER,
    PGPASSWORD: env.PG_PASSWORD || env.DB_PASSWORD || env.PGPASSWORD,
  };
}

function runSqlFile(filename, env) {
  const sqlPath = path.resolve(__dirname, filename);
  if (!fs.existsSync(sqlPath)) {
    console.error(`File not found: ${sqlPath}`);
    process.exit(1);
  }

  const result = spawnSync("psql", ["-v", "ON_ERROR_STOP=1", "-f", sqlPath], {
    stdio: "inherit",
    env,
  });

  if (result.error) {
    console.error("Failed to start psql:", result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status);
  }
}

function showUsage() {
  console.log("Usage: node database/run-db.js [migrate|seed|setup]");
  console.log("  migrate  - run database/migrations/run-migrations.sql");
  console.log("  seed     - run database/run-seeds.sql");
  console.log("  setup    - run migrations and then seeds");
}

const action = process.argv[2];
if (!action) {
  showUsage();
  process.exit(1);
}

const env = buildPgEnv(getEnv());
const required = ["PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD"];
const missing = required.filter((key) => !env[key]);
if (missing.length > 0) {
  console.error("Missing required database environment variables:", missing.join(", "));
  process.exit(1);
}

if (action === "migrate") {
  runSqlFile("run-migrations.sql", env);
} else if (action === "seed") {
  runSqlFile("run-seeds.sql", env);
} else if (action === "setup") {
  runSqlFile("run-migrations.sql", env);
  runSqlFile("run-seeds.sql", env);
} else {
  showUsage();
  process.exit(1);
}
