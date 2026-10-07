const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const ApiError = require('../utils/apiError');
const { uploadMaxMb } = require('../config/env');

// Files live OUTSIDE the frontend folder, so nobody can open them by guessing a URL.
// They are only served through the logged-in download route.
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'reports');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = {
  '.pdf': ['application/pdf'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  // A random name on disk: the visitor's file name is never used as a path.
  filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname).toLowerCase()),
});

const upload = multer({
  storage,
  limits: { fileSize: uploadMaxMb * 1024 * 1024, files: 1, fields: 5 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED[ext] || !ALLOWED[ext].includes(file.mimetype)) {
      return cb(ApiError.badRequest('Only PDF, JPG and PNG files can be uploaded.'));
    }
    return cb(null, true);
  },
});

// A file's name and type can be faked, but its first bytes cannot. Check them after saving.
function looksLikeItsExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const fd = fs.openSync(filePath, 'r');
  const head = Buffer.alloc(8);
  fs.readSync(fd, head, 0, 8, 0);
  fs.closeSync(fd);
  if (ext === '.pdf') return head.slice(0, 4).toString('latin1') === '%PDF';
  if (ext === '.png') return head.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff; // jpg / jpeg
}

const pathFor = (storedName) => path.join(UPLOAD_DIR, path.basename(storedName)); // basename blocks '../'
const removeFile = (filePath) => fs.promises.unlink(filePath).catch(() => {});

module.exports = { uploadSingle: upload.single('file'), looksLikeItsExtension, pathFor, removeFile, ALLOWED };
