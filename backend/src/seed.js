import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { db, stmt } from './db.js';
import { seedFragments } from './services/puzzles.js';

const adminUsername = 'mastermind';
const adminPassword = 'plan_kusursuz_v1';

const existing = stmt.findUserByName.get(adminUsername);
if (!existing) {
  stmt.insertUser.run(
    uuid(),
    adminUsername,
    bcrypt.hashSync(adminPassword, 12),
    'admin',
    3,
    Date.now()
  );
}

seedFragments();

console.log(`[seed] users=${db.count('users')} fragments=${db.count('vault_fragments')}`);
