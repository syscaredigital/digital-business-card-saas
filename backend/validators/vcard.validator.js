function normalizeSections(value, allowedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const sections = {};
  for (const [key, content] of Object.entries(value)) {
    if (!allowedKeys.has(key)) continue;
    const text = typeof content === "string" ? content.trim() : JSON.stringify(content);
    // Uploaded section images are data URLs. The request limit and the plan
    // storage check below provide the real bounds for this JSON content.
    if (text && Buffer.byteLength(text) > 8 * 1024 * 1024) {
      const error = new Error("A VCard section is too large. Remove some images and try again.");
      error.statusCode = 413;
      throw error;
    }
    if (text) sections[key] = text;
  }
  return sections;
}

function normalizeVcardImage(value) {
  const image = String(value || "").trim();
  if (!image) return null;
  if (image.length > 3_000_000) {
    const error = new Error("Each VCard image must be smaller than 2 MB");
    error.statusCode = 413;
    throw error;
  }
  if (/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i.test(image)) return image;
  try {
    const parsed = new URL(image);
    if (["http:", "https:"].includes(parsed.protocol)) return parsed.href;
  } catch (_) {}
  const error = new Error("VCard images must be PNG, JPEG, WebP, or a valid image URL");
  error.statusCode = 400;
  throw error;
}


module.exports = { normalizeSections, normalizeVcardImage };
