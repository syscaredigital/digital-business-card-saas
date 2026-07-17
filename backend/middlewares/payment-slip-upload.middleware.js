const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDirectory = path.resolve(__dirname, "..", "uploads", "payment-slips");
fs.mkdirSync(uploadDirectory, { recursive: true });

const extensionByMime = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

module.exports = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename(req, file, callback) {
      callback(null, `${Date.now()}-${crypto.randomUUID()}${extensionByMime[file.mimetype] || ""}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (!extensionByMime[file.mimetype]) {
      return callback(Object.assign(new Error("Upload a JPG, PNG, WebP, or PDF payment slip"), { status: 400 }));
    }
    callback(null, true);
  },
});
