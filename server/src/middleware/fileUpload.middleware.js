import multer from 'multer';

const storage = multer.memoryStorage();

const ALLOWED_EXTENSIONS = new Set(['.csv', '.xlsx']);
const ALLOWED_MIME_TYPES = new Set([
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
  'text/plain',
]);

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname ? file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase() : '';
    const baseMime = file.mimetype ? file.mimetype.split(';')[0].trim().toLowerCase() : '';

    const isExtAllowed = ALLOWED_EXTENSIONS.has(ext);
    const isMimeAllowed = ALLOWED_MIME_TYPES.has(baseMime);

    if (isExtAllowed || isMimeAllowed) {
      cb(null, true);
    } else {
      const err = new Error("Unsupported file format. Only CSV (.csv) and Excel (.xlsx) files are supported.");
      err.statusCode = 400;
      cb(err, false);
    }
  },
});

/**
 * Express middleware to safely wrap single file upload ('file') and handle multer errors cleanly
 */
export const handleImportFileUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size exceeds maximum allowed limit of 5MB.',
        });
      }
      return res.status(err.statusCode || 400).json({
        success: false,
        message: err.message || 'File upload failed.',
      });
    }
    next();
  });
};

