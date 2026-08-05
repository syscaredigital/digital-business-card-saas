require("dotenv").config();
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { requirePlatformAvailable } = require("./middlewares/platform-access.middleware");
const pool = require("./config/database.config");
const { frontendVcardUrl } = require("./helpers/vcard-url");
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morgan("dev"));

// Serve the public VCard portal and its browser assets from the live API
// process. This keeps public links and QR scans on one reachable origin.
const frontendRoot = path.resolve(__dirname, "..", "frontend");
app.use("/public", express.static(path.join(frontendRoot, "public"), { index: false, fallthrough: true }));
app.use("/pages/public-vcard", express.static(path.join(frontendRoot, "pages", "public-vcard"), { index: false, fallthrough: true }));

app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Register routes
app.post("/api/auth/register", requirePlatformAvailable);
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/public", requirePlatformAvailable, require("./routes/public.routes"));
app.use("/api/user", require("./routes/user.routes"));
app.use("/api/super-admin", require("./routes/super-admin.routes"));

app.get("/vcard/:slug", requirePlatformAvailable, async (req, res, next) => {
  const slug = String(req.params.slug || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,118}[a-z0-9]$/.test(slug)) return res.status(404).json({ message: "VCard not found" });
  try {
    const result = await pool.query(
      `SELECT v.id, t.preview_url
       FROM vcards v
       LEFT JOIN vcard_templates t ON t.id=v.template_id
       WHERE LOWER(v.slug)=$1 AND v.is_active=TRUE`,
      [slug]
    );
    if (!result.rowCount) return res.status(404).json({ message: "VCard not found" });
    const source = req.query.source === "qr" ? "qr" : "public_link";
    return res.redirect(302, frontendVcardUrl(req, result.rows[0].id, source, result.rows[0].preview_url));
  } catch (error) { next(error); }
});


app.use((req, res) => {
  res.status(404).json({ message: "Not Found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (err.name === "MulterError") {
    return res.status(400).json({ message: err.code === "LIMIT_FILE_SIZE" ? "Payment slip must be 5 MB or smaller" : "Unable to upload the payment slip" });
  }
  res.status(err.status || err.statusCode || 500).json({ message: err.publicMessage || err.message || "Internal Server Error" });
});

module.exports = app;
