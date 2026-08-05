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

function frontendVcardUrl(req, id, source, templatePreviewUrl) {
  const configuredPath = String(process.env.PUBLIC_VCARD_PATH || "/pages/public-vcard/final-10-corporate.html");
  const previewPath = String(templatePreviewUrl || "").trim();
  const finalizedMatch = previewPath.match(/(?:^|\/)public-vcard\/(final-[a-z0-9-]+\.html)$/i);
  const path = finalizedMatch ? `/pages/public-vcard/${finalizedMatch[1]}` : configuredPath;
  // Public VCards are served by this application so a client never depends on
  // a developer-only frontend port such as 3000 or 5500 being available.
  const base = requestOrigin(req);
  const target = new URL(path.startsWith("/") ? path : `/${path}`, `${base}/`);
  target.searchParams.set("id", id);
  if (source) target.searchParams.set("source", source);
  return target.href;
}

module.exports = { slugifyVcardName, normalizeCustomSlug, requestOrigin, publicVcardUrl, frontendVcardUrl };
