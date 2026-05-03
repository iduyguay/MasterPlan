import { db, stmt } from '../db.js';
import { aesEncrypt, deriveKey } from './crypto.js';
import { config } from '../config.js';

export const FRAGMENTS = [
  { id: 1, label: 'recon', fragment: 'ALPHA-7F2C', stage: 1 },
  { id: 2, label: 'auth-bypass', fragment: 'BRAVO-9E1A', stage: 2 },
  { id: 3, label: 'cipher', fragment: 'CHARLIE-44D8', stage: 3 },
  { id: 4, label: 'race-window', fragment: 'DELTA-0B5F', stage: 4 }
];

export function seedFragments() {
  for (const f of FRAGMENTS) {
    stmt.insertFragment.run(f.id, f.label, f.fragment, f.stage);
  }
}

export const MASTER_KEY_PHRASE = FRAGMENTS.map(f => f.fragment).join(':');

export function buildStage3Cipher() {
  const key = deriveKey(config.aes.masterKey.toString('hex'), 'masterplan-stage3', 'cipher-channel');
  const message = JSON.stringify({
    fragment: FRAGMENTS[2].fragment,
    hint: '4. asama icin POST /api/stages/4/attempt: { window: ms_unix_aralik, fragments: [...] }',
    next: 'race-window'
  });
  return aesEncrypt(message, key);
}

export function getStage3Key() {
  return deriveKey(config.aes.masterKey.toString('hex'), 'masterplan-stage3', 'cipher-channel');
}

export function getCurrentRaceWindow() {
  const now = Date.now();
  const slot = Math.floor(now / 1500);
  const open = slot % 7 === 0;
  return {
    now,
    slot,
    nextOpenIn: open ? 0 : (7 - (slot % 7)) * 1500,
    open
  };
}

export function ensureProgress(userId) {
  stmt.ensureProgress.run(userId, Date.now());
  return stmt.getProgress.get(userId);
}

export function updateProgress(userId, patch) {
  const current = ensureProgress(userId);
  const fragments = JSON.parse(current.fragments);
  if (patch.addFragment && !fragments.includes(patch.addFragment)) {
    fragments.push(patch.addFragment);
  }
  const next = {
    stage1: patch.stage1 ?? current.stage1,
    stage2: patch.stage2 ?? current.stage2,
    stage3: patch.stage3 ?? current.stage3,
    stage4: patch.stage4 ?? current.stage4,
    stage5: patch.stage5 ?? current.stage5,
    fragments: JSON.stringify(fragments),
    updated_at: Date.now(),
    user_id: userId
  };
  stmt.updateProgress.run(
    next.stage1, next.stage2, next.stage3, next.stage4, next.stage5,
    next.fragments, next.updated_at, next.user_id
  );
  return { ...next, fragments };
}
