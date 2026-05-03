import 'dotenv/config';

const required = (name, fallback) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
};

export const config = {
  port: parseInt(required('PORT', '4000'), 10),
  env: required('NODE_ENV', 'development'),
  corsOrigin: required('CORS_ORIGIN', '*'),
  jwt: {
    publicSecret: required('JWT_PUBLIC_SECRET', 'public_secret_change_me'),
    internalSecret: required('JWT_INTERNAL_SECRET', 'internal_secret_change_me'),
    publicTtl: '15m',
    internalTtl: '5m'
  },
  aes: {
    masterKey: Buffer.from(required('AES_MASTER_KEY'), 'hex')
  },
  db: {
    path: required('DB_PATH', './data/masterplan.db')
  },
  rate: {
    global: parseInt(required('RATE_LIMIT_GLOBAL', '120'), 10),
    auth: parseInt(required('RATE_LIMIT_AUTH', '8'), 10),
    vault: parseInt(required('RATE_LIMIT_VAULT', '3'), 10)
  },
  flags: {
    final: 'MP{ic_iceyim_disindan_zekiyim_planim_kusursuz}'
  }
};
