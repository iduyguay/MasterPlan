import crypto from 'node:crypto';
import { config } from '../config.js';

const ALG = 'aes-256-gcm';

export function aesEncrypt(plaintext, key = config.aes.masterKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${enc.toString('base64url')}.${tag.toString('base64url')}`;
}

export function aesDecrypt(payload, key = config.aes.masterKey) {
  const [ivB64, encB64, tagB64] = payload.split('.');
  if (!ivB64 || !encB64 || !tagB64) throw new Error('malformed_payload');
  const iv = Buffer.from(ivB64, 'base64url');
  const enc = Buffer.from(encB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const decipher = crypto.createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}

export function hmacSign(message, secret) {
  return crypto.createHmac('sha256', secret).update(message).digest('base64url');
}

export function constantTimeEqual(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function deriveKey(masterHex, salt, info) {
  const ikm = Buffer.from(masterHex, 'hex');
  return crypto.hkdfSync('sha256', ikm, Buffer.from(salt), Buffer.from(info), 32);
}

export function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function fingerprint(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}
