import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(status, message, options) {
    super(message, options);
    this.status = status;
  }
}

export function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const field = first?.path?.join('.') || 'input';
    return res.status(400).json({ error: `${field}: ${first?.message}`, issues: err.issues });
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 5 MB).' : err.message;
    return res.status(400).json({ error: message });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: `Invalid ${err.path}` });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ error: Object.values(err.errors)[0]?.message || 'Validation failed' });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'Already exists.' });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 && !(err instanceof HttpError) ? 'Something went wrong.' : err.message });
}
