function slugifyVcardName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function normalizeCustomSlug(value) {
  const supplied = String(value || "").trim();
  if (!supplied) return null;
  const slug = slugifyVcardName(supplied);
  if (slug.length < 3) {
    const error = new Error("The VCard URL name must contain at least 3 letters or numbers");
    error.statusCode = 400;
    error.publicMessage = error.message;
    throw error;
  }
  return slug;
}

function requestOrigin(req) {
  const configured = String(process.env.PUBLIC_APP_URL || "").trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (["http:", "https:"].includes(url.protocol)) return url.origin + url.pathname.replace(/\/+$/, "");
    } catch (_) {}
  }
  return `${req.protocol}://${req.get("host")}`;
}

function publicVcardUrl(req, slug) {
  return `${requestOrigin(req)}/vcard/${encodeURIComponent(slug)}`;
}

function frontendVcardUrl(id, source) {
  const frontend = String(process.env.FRONTEND_URL || "").trim().replace(/\/+$/, "");
  const path = String(process.env.PUBLIC_VCARD_PATH || "/pages/public-vcard/profile.html");
  const base = frontend || "http://127.0.0.1:5500";
  const target = new URL(path.startsWith("/") ? path : `/${path}`, `${base}/`);
  target.searchParams.set("id", id);
  if (source) target.searchParams.set("source", source);
  return target.href;
}

module.exports = { slugifyVcardName, normalizeCustomSlug, requestOrigin, publicVcardUrl, frontendVcardUrl };
