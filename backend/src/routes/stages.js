import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { publicAuth, requireClearance } from '../middleware/auth.js';
import { tokenBucket } from '../middleware/rateLimit.js';
import { audit } from '../middleware/audit.js';
import {
  buildStage3Cipher,
  getStage3Key,
  FRAGMENTS,
  updateProgress,
  ensureProgress,
  getCurrentRaceWindow
} from '../services/puzzles.js';
import { aesDecrypt, constantTimeEqual } from '../services/crypto.js';

export const stagesRouter = Router();

stagesRouter.use(tokenBucket({ key: 'stages', capacity: 30, refillPerSec: 1 }));
stagesRouter.use(audit('stages'));

stagesRouter.post('/2', publicAuth, (req, res) => {
  const challenge = jwt.sign(
    { sub: req.user.id, role: 'agent', clearance: 1, purpose: 'elevation' },
    config.jwt.publicSecret,
    { algorithm: 'HS256', expiresIn: '5m', issuer: 'masterplan-public' }
  );
  res.set('X-Hint', 'Bu token zayif imzali. Claim\'lari degistir, ayni HS256 ile imzala.');
  res.set('X-Algorithm', 'HS256');
  res.json({
    challenge_token: challenge,
    instructions: [
      'Token\'in payload\'ini decode et.',
      'role -> "admin", clearance -> 3 yap.',
      'Ayni gizli anahtarla yeniden imzala.',
      'POST /api/auth/elevate { challenge_token: yeni_token } gonder.'
    ]
  });
});

stagesRouter.get('/3', publicAuth, requireClearance(3), (req, res) => {
  const progress = ensureProgress(req.user.id);
  if (progress.stage2 !== 1) {
    return res.status(403).json({ error: 'finish_stage_2_first' });
  }
  res.set('X-Hint', 'Cipher AES-256-GCM. Anahtar HKDF(masterKey, salt="masterplan-stage3", info="cipher-channel").');
  res.set('X-Salt', 'masterplan-stage3');
  res.set('X-Info', 'cipher-channel');
  res.json({
    stage: 3,
    cipher: buildStage3Cipher(),
    format: 'iv.cipher.tag (base64url)',
    submit_to: 'POST /api/stages/3/submit { plaintext }'
  });
});

stagesRouter.post('/3/submit', publicAuth, requireClearance(3), (req, res) => {
  const { plaintext } = req.body || {};
  if (!plaintext) return res.status(400).json({ error: 'missing_plaintext' });
  try {
    const key = getStage3Key();
    const cipher = buildStage3Cipher();
    const expected = aesDecrypt(cipher, key);
    if (!constantTimeEqual(plaintext, expected)) {
      return res.status(400).json({ error: 'plaintext_mismatch' });
    }
    const progress = updateProgress(req.user.id, {
      stage3: 1,
      addFragment: FRAGMENTS[2].fragment
    });
    res.json({ ok: true, fragment: FRAGMENTS[2].fragment, progress });
  } catch (e) {
    res.status(400).json({ error: 'submit_failed', detail: e.message });
  }
});

const stage4Limiter = tokenBucket({ key: 'stage4', capacity: 4, refillPerSec: 0.4 });

stagesRouter.get('/4/window', publicAuth, requireClearance(3), (req, res) => {
  const win = getCurrentRaceWindow();
  res.set('X-Hint', 'Slot numarasi 7\'ye bolunduginde kalan 0 olmali. Race-window dar.');
  res.json(win);
});

stagesRouter.post('/4/attempt', publicAuth, requireClearance(3), stage4Limiter, (req, res) => {
  const progress = ensureProgress(req.user.id);
  if (progress.stage3 !== 1) {
    return res.status(403).json({ error: 'finish_stage_3_first' });
  }
  const win = getCurrentRaceWindow();
  if (!win.open) {
    res.set('Retry-After', String(Math.ceil(win.nextOpenIn / 1000)));
    return res.status(425).json({ error: 'window_closed', next_open_in_ms: win.nextOpenIn });
  }
  const { fragments } = req.body || {};
  if (!Array.isArray(fragments)) {
    return res.status(400).json({ error: 'fragments_required' });
  }
  const expected = FRAGMENTS.slice(0, 3).map(f => f.fragment);
  const ok = expected.every(f => fragments.includes(f));
  if (!ok) {
    return res.status(400).json({ error: 'fragments_incomplete', need: expected });
  }
  const newProgress = updateProgress(req.user.id, {
    stage4: 1,
    addFragment: FRAGMENTS[3].fragment
  });
  res.json({
    ok: true,
    fragment: FRAGMENTS[3].fragment,
    progress: newProgress,
    next: 'POST /api/vault/unlock { master_key: "ALPHA-...:BRAVO-...:CHARLIE-...:DELTA-..." }'
  });
});
