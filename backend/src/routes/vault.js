import { Router } from 'express';
import { publicAuth, requireClearance } from '../middleware/auth.js';
import { tokenBucket } from '../middleware/rateLimit.js';
import { audit } from '../middleware/audit.js';
import { config } from '../config.js';
import {
  MASTER_KEY_PHRASE,
  ensureProgress,
  updateProgress
} from '../services/puzzles.js';
import { constantTimeEqual } from '../services/crypto.js';

export const vaultRouter = Router();

vaultRouter.use(audit('vault'));

vaultRouter.post(
  '/unlock',
  tokenBucket({ key: 'vault', capacity: 3, refillPerSec: 0.05 }),
  publicAuth,
  requireClearance(3),
  (req, res) => {
    const progress = ensureProgress(req.user.id);
    if (progress.stage4 !== 1) {
      return res.status(403).json({ error: 'all_stages_required', progress });
    }
    const { master_key } = req.body || {};
    if (!master_key) return res.status(400).json({ error: 'missing_master_key' });

    if (!constantTimeEqual(master_key, MASTER_KEY_PHRASE)) {
      return res.status(403).json({ error: 'master_key_invalid' });
    }

    const finalProgress = updateProgress(req.user.id, { stage5: 1 });
    res.set('X-Status', 'vault-open');
    res.json({
      status: 'VAULT_OPEN',
      flag: config.flags.final,
      progress: finalProgress,
      message: 'Plan kusursuz isledi. Operasyon tamam.'
    });
  }
);

vaultRouter.get('/status', publicAuth, (req, res) => {
  const progress = ensureProgress(req.user.id);
  res.json({
    progress,
    fragments: JSON.parse(progress.fragments),
    locked: progress.stage5 !== 1
  });
});
