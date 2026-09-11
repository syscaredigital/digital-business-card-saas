const { Pool } = require("pg");
require('./environment');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true,
    ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n') } : {}) } : undefined,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: Number(process.env.DB_POOL_SIZE || 10),
  statement_timeout: 30000,
});

module.exports = pool;
pool.on('error', error => console.error('Idle database connection error:', error.code || error.name));
