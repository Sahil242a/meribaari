import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { config, isProd } from './config.js';
import publicRoutes from './routes/public.js';
import authRoutes from './routes/auth.js';
import staffRoutes from './routes/staff.js';
import { errorHandler, notFound } from './middleware/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // correct client IPs behind Render/Railway for rate limiting

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'connect-src': ["'self'", 'ws:', 'wss:'],
          'img-src': ["'self'", 'data:'],
        },
      },
    })
  );
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '20kb' }));
  app.use(cookieParser());
  if (config.env === 'development') app.use(morgan('dev'));

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'meribaari' }));
  app.use('/api/auth', authRoutes);
  app.use('/api/staff', staffRoutes);
  app.use('/api', publicRoutes);
  app.use('/api', notFound);

  // In production one service serves both the API and the built React app.
  if (isProd && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
