import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import jobRoutes from './routes/jobs.js';
import reportRoutes from './routes/reports.js';
import videoRoutes from './routes/videos.js';
import analysisRoutes from './routes/analysis.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/analysis', analysisRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`);
});
