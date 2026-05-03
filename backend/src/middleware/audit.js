import { stmt } from '../db.js';

export function audit(note) {
  return (req, res, next) => {
    res.on('finish', () => {
      try {
        stmt.insertAudit.run(
          req.user?.id ?? null,
          req.ip || req.headers['x-forwarded-for'] || 'unknown',
          req.method,
          req.originalUrl,
          res.statusCode,
          note ?? null,
          Date.now()
        );
      } catch {}
    });
    next();
  };
}
