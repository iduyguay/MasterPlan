import { Router } from 'express';
import { tokenBucket } from '../middleware/rateLimit.js';
import { publicAuth } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import { FRAGMENTS, updateProgress } from '../services/puzzles.js';
import { fingerprint } from '../services/crypto.js';

export const reconRouter = Router();

reconRouter.use(tokenBucket({ key: 'recon', capacity: 30, refillPerSec: 1 }));
reconRouter.use(audit('recon'));

reconRouter.get('/portal', (req, res) => {
  res.set('X-Trail', '/api/recon/portal/secret');
  res.set('X-Required-Header', 'X-Operative-Tag: must contain "masterplan"');
  res.json({
    portal: 'recon',
    welcome: 'Hos geldin operative. Bu kapidan gectin ama icerideki kapi farkli.',
    challenge: 'Headerlari oku. Saklanan kapiyi bul. X-Operative-Tag header\'i ile gel.'
  });
});

reconRouter.get('/portal/secret', (req, res) => {
  const tag = String(req.headers['x-operative-tag'] || '').toLowerCase();
  if (!tag.includes('masterplan')) {
    res.set('X-Hint', 'X-Operative-Tag header\'in icinde "masterplan" gecmeli.');
    return res.status(403).json({ error: 'wrong_signal' });
  }

  const fp = fingerprint(req.ip + ':masterplan:operative');
  res.set('X-Trail', '/api/auth/register');
  res.json({
    stage: 1,
    status: 'cleared',
    fragment: FRAGMENTS[0].fragment,
    fingerprint: fp,
    next: {
      action: 'POST /api/auth/register',
      payload: { username: 'string', password: 'string', invite: 'fingerprint_yukarida' }
    },
    note_for_logs: 'Bu fragmani sakla. Vault\'ta gerekli.'
  });
});

reconRouter.post('/claim', publicAuth, (req, res) => {
  const progress = updateProgress(req.user.id, {
    stage1: 1,
    addFragment: FRAGMENTS[0].fragment
  });
  res.json({ ok: true, progress });
});
