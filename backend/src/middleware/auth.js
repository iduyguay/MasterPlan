import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { stmt } from '../db.js';

export function signPublicToken(payload) {
  return jwt.sign(payload, config.jwt.publicSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwt.publicTtl,
    issuer: 'masterplan-public'
  });
}

export function signInternalToken(payload) {
  return jwt.sign(payload, config.jwt.internalSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwt.internalTtl,
    issuer: 'masterplan-internal'
  });
}

export function publicAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_token' });
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwt.publicSecret, {
      algorithms: ['HS256'],
      issuer: 'masterplan-public'
    });
    const user = stmt.findUserById.get(decoded.sub);
    if (!user) return res.status(401).json({ error: 'unknown_subject' });
    req.user = {
      ...user,
      role: decoded.role || user.role,
      clearance: typeof decoded.clearance === 'number' ? decoded.clearance : user.clearance
    };
    req.token = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid_token', detail: e.message });
  }
}

export function internalAuth(req, res, next) {
  const header = req.headers['x-internal-token'];
  if (!header) return res.status(401).json({ error: 'missing_internal_token' });
  try {
    const decoded = jwt.verify(header, config.jwt.internalSecret, {
      algorithms: ['HS256'],
      issuer: 'masterplan-internal'
    });
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'insufficient_role' });
    req.internal = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid_internal_token', detail: e.message });
  }
}

export function requireClearance(level) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'auth_required' });
    if (req.user.clearance < level) {
      return res.status(403).json({ error: 'clearance_insufficient', required: level });
    }
    next();
  };
}
