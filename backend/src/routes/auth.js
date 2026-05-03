import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import jwt from 'jsonwebtoken';
import { stmt } from '../db.js';
import { signPublicToken, publicAuth } from '../middleware/auth.js';
import { tokenBucket } from '../middleware/rateLimit.js';
import { audit } from '../middleware/audit.js';
import { fingerprint } from '../services/crypto.js';
import { ensureProgress, updateProgress, FRAGMENTS } from '../services/puzzles.js';
import { config } from '../config.js';

export const authRouter = Router();

authRouter.use(tokenBucket({ key: 'auth', capacity: 8, refillPerSec: 0.5 }));
authRouter.use(audit('auth'));

authRouter.post('/register', (req, res) => {
  const { username, password, invite } = req.body || {};
  if (!username || !password || !invite) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'weak_password' });
  }
  const expected = fingerprint(req.ip + ':masterplan:operative');
  if (invite !== expected) {
    res.set('X-Hint', 'Invite, recon stage\'inden geliyor. fingerprint\'ini bul.');
    return res.status(403).json({ error: 'invalid_invite' });
  }

  const exists = stmt.findUserByName.get(username);
  if (exists) return res.status(409).json({ error: 'username_taken' });

  const id = uuid();
  const hash = bcrypt.hashSync(password, 12);
  stmt.insertUser.run(id, username, hash, 'agent', 1, Date.now());
  ensureProgress(id);
  updateProgress(id, { stage1: 1, addFragment: FRAGMENTS[0].fragment });

  const token = signPublicToken({ sub: id, role: 'agent', clearance: 1 });
  res.status(201).json({ id, username, token, clearance: 1 });
});

authRouter.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'missing_fields' });
  const user = stmt.findUserByName.get(username);
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
  const token = signPublicToken({ sub: user.id, role: user.role, clearance: user.clearance });
  res.json({ token, role: user.role, clearance: user.clearance });
});

authRouter.get('/me', publicAuth, (req, res) => {
  const progress = ensureProgress(req.user.id);
  res.json({
    id: req.user.id,
    username: req.user.username,
    role: req.user.role,
    clearance: req.user.clearance,
    progress: { ...progress, fragments: JSON.parse(progress.fragments) }
  });
});

authRouter.post('/elevate', publicAuth, (req, res) => {
  const { challenge_token } = req.body || {};
  if (!challenge_token) {
    res.set('X-Hint', 'POST /api/stages/2 ile bir challenge token al, asymmetric degil HS256.');
    return res.status(400).json({ error: 'missing_challenge_token' });
  }
  try {
    const decoded = jwt.verify(challenge_token, config.jwt.publicSecret, {
      algorithms: ['HS256'],
      issuer: 'masterplan-public'
    });
    if (decoded.sub !== req.user.id) {
      return res.status(403).json({ error: 'subject_mismatch' });
    }
    if (decoded.role !== 'admin' || decoded.clearance < 3) {
      res.set('X-Hint', 'Token icindeki claim\'leri yeniden imzala. role=admin, clearance>=3.');
      return res.status(403).json({ error: 'claim_insufficient', got: { role: decoded.role, clearance: decoded.clearance } });
    }
    const progress = updateProgress(req.user.id, {
      stage2: 1,
      addFragment: FRAGMENTS[1].fragment
    });
    const newToken = signPublicToken({ sub: req.user.id, role: 'admin', clearance: 3 });
    res.json({
      ok: true,
      token: newToken,
      fragment: FRAGMENTS[1].fragment,
      progress
    });
  } catch (e) {
    return res.status(400).json({ error: 'invalid_challenge_token', detail: e.message });
  }
});
