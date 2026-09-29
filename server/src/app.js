import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { errorHandler, notFound } from './middleware/error.js';
import assistantRoutes from './routes/assistant.js';
import authRoutes from './routes/auth.js';
import driveRoutes from './routes/drives.js';
import insightRoutes from './routes/insights.js';
import profileRoutes from './routes/profile.js';
import resumeRoutes from './routes/resume.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // behind nginx / Render's proxy, so rate limiting sees the real IP
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin.split(',').map((s) => s.trim()) }));
  app.use(express.json({ limit: '1mb' }));
  if (!config.isProd) app.use(morgan('dev'));

  app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'placemate-api' }));
  app.use('/api/auth', authRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/resume', resumeRoutes);
  app.use('/api/drives', driveRoutes);
  app.use('/api/insights', insightRoutes);
  app.use('/api/assistant', assistantRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
