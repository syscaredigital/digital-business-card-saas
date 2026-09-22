const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const { PDFDocument, PDFDict, PDFArray, PDFName, PDFStream } = require('pdf-lib');
const uploadDirectory = path.resolve(__dirname, '..', 'uploads', 'payment-slips');
const extensionByMime = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' };
const invalid = () => Object.assign(new Error('Upload a valid JPG, PNG, WebP, or PDF receipt without active content'), { status: 400 });
const limitUploads = require('./rate-limit.middleware')({limit:30,scope:'payment-receipts'});

async function validateReceipt(buffer, mime) {
  if (!extensionByMime[mime] || !buffer.length || buffer.length > 5 * 1024 * 1024) throw invalid();
  try {
    if (mime === 'application/pdf') {
      if (!buffer.subarray(0,8).toString('ascii').match(/^%PDF-[12]\.[0-9]/) || !/%%EOF\s*$/.test(buffer.subarray(-1024).toString('latin1'))) throw invalid();
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: false, throwOnInvalidObject: true, updateMetadata: false });
      if (doc.getPageCount() < 1 || doc.getPageCount() > 100) throw invalid();
      const forbidden = new Set(['JS','JavaScript','Launch','OpenAction','AA','EmbeddedFiles','EmbeddedFile','Filespec','RichMedia','XFA','AcroForm','SubmitForm','ImportData','GoToR','GoToE','URI']);
      const seen = new Set();
      function inspect(object) {
        if (!object || seen.has(object)) return;
        seen.add(object);
        if (object instanceof PDFName && forbidden.has(object.decodeText())) throw invalid();
        if (object instanceof PDFStream) inspect(object.dict);
        if (object instanceof PDFDict) for (const [key,value] of object.entries()) { inspect(key); inspect(value); }
        if (object instanceof PDFArray) for (const value of object.asArray()) inspect(value);
      }
      for (const [,object] of doc.context.enumerateIndirectObjects()) inspect(object);
      const clean = Buffer.from(await doc.save());
      if (clean.length > 5 * 1024 * 1024) throw invalid();
      return clean;
    }
    const expected = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' }[mime];
    const image = sharp(buffer, { failOn: 'warning', limitInputPixels: 20000000 });
    const metadata = await image.metadata();
    if (metadata.format !== expected || (metadata.pages || 1) !== 1) throw invalid();
    // Decode and re-encode rather than saving attacker-supplied metadata/trailing data.
    const clean = await image.rotate().toFormat(expected).toBuffer();
    if (clean.length > 5 * 1024 * 1024) throw invalid();
    return clean;
  } catch (_) { throw invalid(); }
}
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 30, parts: 31 },
  fileFilter(req,file,callback) { callback(extensionByMime[file.mimetype] ? null : invalid(), Boolean(extensionByMime[file.mimetype])); }
});
module.exports = {
  validateReceipt,
  single(field) {
    const receive = upload.single(field);
    const handle = (req,res,next) => receive(req,res,async error => {
      if (error) return next(error);
      if (!req.file) return next();
      try {
        const clean = await validateReceipt(req.file.buffer,req.file.mimetype);
        await fs.promises.mkdir(uploadDirectory,{ recursive: true });
        const filename = crypto.randomUUID() + extensionByMime[req.file.mimetype];
        const filePath = path.join(uploadDirectory,filename);
        await fs.promises.writeFile(filePath,clean,{ flag: 'wx', mode: 0o600 });
        delete req.file.buffer;
        Object.assign(req.file,{ destination: uploadDirectory, filename, path: filePath, size: clean.length });
        // Validation or business-rule failures must not leave orphan payment documents.
        res.once('finish',() => { if (res.statusCode >= 400) fs.promises.unlink(filePath).catch(() => {}); });
        next();
      } catch (failure) { delete req.file; next(failure); }
    });
    return (req,res,next) => limitUploads(req,res,error => error ? next(error) : handle(req,res,next));
  }
};
