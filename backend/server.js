import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './src/config.js';
import { indexRouter } from './src/routes/index.js';
import { reconRouter } from './src/routes/recon.js';
import { authRouter } from './src/routes/auth.js';
import { stagesRouter } from './src/routes/stages.js';
import { vaultRouter } from './src/routes/vault.js';
import { tokenBucket } from './src/middleware/rateLimit.js';
import { seedFragments } from './src/services/puzzles.js';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '64kb' }));
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));

app.use('/api', tokenBucket({ key: 'global', capacity: config.rate.global, refillPerSec: 2 }));

app.use('/api/recon', reconRouter);
app.use('/api/auth', authRouter);
app.use('/api/stages', stagesRouter);
app.use('/api/vault', vaultRouter);
app.use('/api', indexRouter);

app.use((err, req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'internal_error' });
});

seedFragments();

app.listen(config.port, '0.0.0.0', () => {
  console.log(`[masterplan] listening on :${config.port} env=${config.env}`);
});
