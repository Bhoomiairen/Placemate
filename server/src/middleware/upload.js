import multer from 'multer';
import { HttpError } from './error.js';

// Files are kept in memory and forwarded to the NLP service; nothing is written to disk.
export const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    cb(isPdf ? null : new HttpError(400, 'Only PDF files are allowed.'), isPdf);
  },
}).single('file');
