import { Router } from 'express';
import { config } from '../config.js';

export const indexRouter = Router();

indexRouter.get('/', (req, res) => {
  res.set('X-Trail', '/api/recon/portal');
  res.set('X-Operation', 'masterplan');
  res.set('X-Clearance-Required', '1');
  res.json({
    operation: 'MASTERPLAN',
    motto: 'Plan kusursuzdur. Plani bozmak senin isin.',
    objective: 'Kasayi ac. Dort fragmani topla. Vault\'u zorla.',
    entrypoints: {
      health: '/api/health',
      recon: '/api/recon/portal',
      auth: '/api/auth/*',
      stages: '/api/stages/*',
      vault: '/api/vault/unlock'
    },
    rules: [
      'Her cevap headerlari oku.',
      'Hicbir hint kalin yazi degil. Saklanmis olabilir.',
      'Rate limit gercek. Sabir kazandirir.'
    ]
  });
});

indexRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', env: config.env, time: Date.now() });
});

indexRouter.use((req, res) => {
  res.set('X-Hint', 'Kayboldun. /api kokune don, headerlari oku.');
  res.status(404).json({ error: 'not_found', path: req.originalUrl });
});
