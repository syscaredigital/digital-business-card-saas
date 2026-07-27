const pool = require("../config/database.config");

let cachedMaintenanceMode = false;
let cacheExpiresAt = 0;

async function maintenanceEnabled() {
  if (Date.now() < cacheExpiresAt) return cachedMaintenanceMode;
  const result = await pool.query("SELECT value FROM settings WHERE key='maintenance_mode' LIMIT 1");
  cachedMaintenanceMode = String(result.rows[0]?.value || "false").toLowerCase() === "true";
  cacheExpiresAt = Date.now() + 2000;
  return cachedMaintenanceMode;
}

async function requirePlatformAvailable(req, res, next) {
  try {
    if (await maintenanceEnabled()) {
      return res.status(503).json({
        message: "Sync E-Card is temporarily unavailable while scheduled maintenance is in progress.",
        code: "PLATFORM_MAINTENANCE",
      });
    }
    next();
  } catch (error) {
    next(error);
  }
}

function invalidatePlatformAccessCache() {
  cacheExpiresAt = 0;
}

module.exports = { requirePlatformAvailable, invalidatePlatformAccessCache };
