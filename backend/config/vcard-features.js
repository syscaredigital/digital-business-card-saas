const VCARD_FEATURES = Object.freeze([
  { key: "basic-details", label: "Basic Details" },
  { key: "business-hours", label: "Business Hours" },
  { key: "qrcode-customize", label: "Customize QR Code" },
  { key: "services", label: "Services" },
  { key: "products", label: "Products" },
  { key: "instagram-embed", label: "InstaEmbed" },
  { key: "galleries", label: "Galleries" },
  { key: "blogs", label: "Blogs" },
  { key: "testimonials", label: "Testimonials" },
  { key: "iframes", label: "Iframes" },
  { key: "appointments", label: "Appointments" },
  { key: "social-links", label: "Social links - Website" },
  { key: "custom-links", label: "Custom Links" },
  { key: "banners", label: "Banner" },
  { key: "advanced", label: "Advanced" },
  { key: "custom-fonts", label: "Fonts" },
  { key: "seo", label: "SEO" },
  { key: "privacy-policy", label: "Privacy Policy" },
  { key: "term-condition", label: "Terms & Conditions" },
  { key: "manage-section", label: "Manage Section" },
]);

const VCARD_FEATURE_KEYS = new Set(VCARD_FEATURES.map((feature) => feature.key));

function normalizePlanFeatures(value) {
  if (Array.isArray(value)) {
    return { benefits: value.map(String), vcardFeatures: ["basic-details"], templateIds: [] };
  }
  const input = value && typeof value === "object" ? value : {};
  return {
    benefits: Array.isArray(input.benefits) ? input.benefits.map(String) : [],
    vcardFeatures: Array.isArray(input.vcardFeatures)
      ? Array.from(new Set(input.vcardFeatures.map(String).filter((key) => VCARD_FEATURE_KEYS.has(key))))
      : ["basic-details"],
    templateIds: Array.isArray(input.templateIds)
      ? Array.from(new Set(input.templateIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)))
      : [],
  };
}

module.exports = { VCARD_FEATURES, VCARD_FEATURE_KEYS, normalizePlanFeatures };
