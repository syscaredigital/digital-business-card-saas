function slugifyVcardName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 100)
    .replace(/^-+|-+$/g, "");
}

function normalizeCustomSlug(value) {
  const supplied = String(value || "").trim();
  if (!supplied) return null;
  let slug = supplied;
  if (/^https?:\/\//i.test(supplied)) {
    try {
      const url = new URL(supplied);
      if (url.search || url.hash || supplied.includes('\\')) throw new Error();
      slug = decodeURIComponent(url.pathname.replace(/^\/(?:vcard\/)?/, ''));
    } catch (_) { slug = ''; }
  }
  if (['api', 'pages', 'public', 'components', 'layouts', 'health', 'ready', 'vcard'].includes(slug.toLowerCase())) {
    const error = new Error('This URL name is reserved. Choose another name.');
    error.statusCode = 400;
    error.publicMessage = error.message;
    throw error;
  }
  if (!isValidVcardSlug(slug)) {
    const error = new Error("Use 3–100 URL-name characters: letters, numbers, or symbols such as ! _ & -. Do not include spaces, slashes, query strings, or fragments.");
    error.statusCode = 400;
    error.publicMessage = error.message;
    throw error;
  }
  return slug;
}

function isValidVcardSlug(value, maxLength = 100) {
  return value.length >= 3 && value.length <= maxLength && /^[A-Za-z0-9._~!$&'()*+,;=:@-]+$/.test(value);
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
  return `${requestOrigin(req)}/${encodeURIComponent(slug)}`;
}

function frontendVcardUrl(req, id, source, templatePreviewUrl) {
  const configuredPath = String(process.env.PUBLIC_VCARD_PATH || "/pages/public-vcard/final-12-corporate-classic.html");
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

module.exports = { slugifyVcardName, normalizeCustomSlug, isValidVcardSlug, requestOrigin, publicVcardUrl, frontendVcardUrl };
