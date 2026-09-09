const fs = require("fs");
const crypto = require("crypto");
const helmet = require("helmet");
const cache = new Map();

// Authorize the existing inline page scripts by content hash, without allowing
// arbitrary injected inline JavaScript. External scripts remain same-origin.
module.exports = function frontendHeaders(res, file, stat) {
  if (!file.endsWith(".html")) return;
  let entry = cache.get(file);
  if (!entry || entry.modified !== stat.mtimeMs) {
    const html = fs.readFileSync(file, "utf8").replace(/\r\n?/g, "\n");
    const hashes = [];
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc\s*=/.test(match[1]) || !match[2].trim()) continue;
      hashes.push(`'sha256-${crypto.createHash("sha256").update(match[2]).digest("base64")}'`);
    }
    const directives = helmet.contentSecurityPolicy.getDefaultDirectives();
    directives["script-src"] = ["'self'", ...hashes];
    if (process.env.NODE_ENV !== "production") delete directives["upgrade-insecure-requests"];
    entry = {
      modified: stat.mtimeMs,
      policy: Object.entries(directives).map(([key, values]) => `${key} ${values.join(" ")}`.trim()).join("; "),
    };
    cache.set(file, entry);
  }
  res.setHeader("Content-Security-Policy", entry.policy);
  res.setHeader("Referrer-Policy", "no-referrer");
};
