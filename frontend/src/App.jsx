import { useEffect, useState, useCallback } from 'react';
import { Terminal } from './components/Terminal.jsx';
import { HUD } from './components/HUD.jsx';
import { api, setToken, getToken } from './api.js';

const BANNER = String.raw`

   __  __    _    ____ _____ _____ ____
  |  \/  |  / \  / ___|_   _| ____|  _ \
  | |\/| | / _ \ \___ \ | | |  _| | |_) |
  | |  | |/ ___ \ ___) || | | |___|  _ <
  |_|__|_/_/___\_\____/_|_|_|_____|_| \_\
  | _ \ |  / \ | \ | |
  |  _/ |_/ _ \|  \| |
  |_| |____/_/ \_\_|\_|

  // OPERATION CONSOLE  v1.0
`;

function fmt(label, obj) {
  return `${label}\n` + JSON.stringify(obj, null, 2);
}

function decodeJwt(token) {
  try {
    const [, payload] = token.split('.');
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function hmacSha256(message, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function forgeToken(originalToken, secret, patch) {
  const [headerB64, payloadB64] = originalToken.split('.');
  const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
  const newPayload = { ...payload, ...patch };
  const newPayloadB64 = btoa(JSON.stringify(newPayload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const signing = `${headerB64}.${newPayloadB64}`;
  const sig = await hmacSha256(signing, secret);
  return `${signing}.${sig}`;
}

async function aesGcmDecrypt(payload, hexKey) {
  const [ivB64, ctB64, tagB64] = payload.split('.');
  const decode = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const iv = decode(ivB64);
  const ct = decode(ctB64);
  const tag = decode(tagB64);
  const combined = new Uint8Array(ct.length + tag.length);
  combined.set(ct);
  combined.set(tag, ct.length);
  const keyBytes = new Uint8Array(hexKey.match(/.{1,2}/g).map(b => parseInt(b, 16)));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, combined);
  return new TextDecoder().decode(dec);
}

async function hkdfSha256(masterHex, salt, info, length = 32) {
  const ikm = new Uint8Array(masterHex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
  const baseKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const enc = new TextEncoder();
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode(salt), info: enc.encode(info) },
    baseKey, length * 8
  );
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function App() {
  const [lines, setLines] = useState([]);
  const [progress, setProgress] = useState(null);
  const [fragments, setFragments] = useState([]);
  const [status, setStatus] = useState('OFFLINE');
  const [authed, setAuthed] = useState(!!getToken());
  const [stage2Token, setStage2Token] = useState(null);

  const push = useCallback((text, kind = 'out') => {
    setLines(ls => [...ls, { text, kind }]);
  }, []);

  useEffect(() => {
    const startup = BANNER.split('\n');
    let i = 0;
    const id = setInterval(() => {
      if (i >= startup.length) {
        clearInterval(id);
        push('  baglanti kuruluyor...', 'sys');
        setTimeout(async () => {
          const r = await api.health();
          if (r.ok) {
            push(`  link kuruldu  [${r.body.env}]  t=${r.body.time}`, 'ok');
            setStatus('ONLINE');
            push('', 'out');
            push('  > "scan" yaz, operasyona basla. "help" tum komutlar.', 'sys');
          } else {
            push('  baglanti basarisiz. backend\'i kontrol et.', 'err');
            setStatus('LINK_DOWN');
          }
        }, 250);
        return;
      }
      push(startup[i], 'banner');
      i++;
    }, 30);
    return () => clearInterval(id);
  }, [push]);

  useEffect(() => {
    if (!authed) return;
    refreshStatus();
  }, [authed]);

  async function refreshStatus() {
    const r = await api.vaultStatus();
    if (r.ok) {
      setProgress(r.body.progress);
      setFragments(r.body.fragments || []);
    }
  }

  async function handle(cmd) {
    push(`> ${cmd}`, 'in');
    const [head, ...rest] = cmd.trim().split(/\s+/);
    const arg = rest.join(' ');

    try {
      switch (head) {
        case 'help':
          push('komutlar:\n' +
            '  scan                            recon portal taramasi\n' +
            '  register <user> <pass>          kayit (invite otomatik)\n' +
            '  login <user> <pass>             giris\n' +
            '  stage2                          jwt challenge token al\n' +
            '  forge <token>                   token\'i admin yap (HS256)\n' +
            '  elevate <token>                 forge edilmis token\'i gonder\n' +
            '  cipher                          stage 3 sifreli paketi al\n' +
            '  decrypt <ciphertext>            tarayicida AES-GCM coz\n' +
            '  window                          stage 4 race window\n' +
            '  race                            uygun anda fragment yarisi\n' +
            '  unlock                          vault\'u ac (master_key)\n' +
            '  status                          ilerleme\n' +
            '  clear                           ekrani temizle\n' +
            '  logout                          oturumu kapat', 'sys');
          break;

        case 'clear':
          setLines([]);
          break;

        case 'scan': {
          const root = await api.root();
          push(fmt('GET /api', root.body), 'data');
          push(`X-Trail: ${root.headers['x-trail']}`, 'hint');
          const portal = await api.reconPortal();
          push(fmt('GET /api/recon/portal', portal.body), 'data');
          push(`X-Trail: ${portal.headers['x-trail']}`, 'hint');
          push(`X-Required-Header: ${portal.headers['x-required-header']}`, 'hint');
          const secret = await api.reconSecret('operative-masterplan-v1');
          if (secret.ok) {
            push(fmt('GET /api/recon/portal/secret', secret.body), 'ok');
            push(`fragment alindi: ${secret.body.fragment}`, 'good');
            push(`invite fingerprint: ${secret.body.fingerprint}`, 'hint');
            push('siradaki: register <user> <pass>', 'sys');
          } else {
            push(fmt('hata', secret.body), 'err');
          }
          break;
        }

        case 'register': {
          const [u, p] = rest;
          if (!u || !p) { push('kullanim: register <user> <pass>', 'err'); break; }
          const sec = await api.reconSecret('operative-masterplan-v1');
          if (!sec.ok) { push('once recon (scan) bitir.', 'err'); break; }
          const r = await api.register({ username: u, password: p, invite: sec.body.fingerprint });
          if (r.ok) {
            setToken(r.body.token);
            setAuthed(true);
            push(`kayit ok. id=${r.body.id} clearance=${r.body.clearance}`, 'good');
            await refreshStatus();
          } else {
            push(fmt('register hata', r.body), 'err');
          }
          break;
        }

        case 'login': {
          const [u, p] = rest;
          if (!u || !p) { push('kullanim: login <user> <pass>', 'err'); break; }
          const r = await api.login({ username: u, password: p });
          if (r.ok) {
            setToken(r.body.token);
            setAuthed(true);
            push(`giris ok. role=${r.body.role} clearance=${r.body.clearance}`, 'good');
            await refreshStatus();
          } else {
            push(fmt('login hata', r.body), 'err');
          }
          break;
        }

        case 'logout':
          setToken(null);
          setAuthed(false);
          setProgress(null);
          setFragments([]);
          push('oturum kapatildi.', 'sys');
          break;

        case 'stage2': {
          const r = await api.stage2();
          if (!r.ok) { push(fmt('stage2 hata', r.body), 'err'); break; }
          setStage2Token(r.body.challenge_token);
          push(fmt('challenge', r.body), 'data');
          const decoded = decodeJwt(r.body.challenge_token);
          push(fmt('decoded payload', decoded), 'hint');
          push('forge ile claim\'leri admin/3 yap. Sirri keşfetmek icin /api kokunu/headerlari oku.', 'sys');
          push('ipucu: env\'den JWT_PUBLIC_SECRET kullan veya "forge auto" ile sunucuyla ayni sirri varsayalim.', 'hint');
          break;
        }

        case 'forge': {
          const tok = arg || stage2Token;
          if (!tok) { push('once "stage2" cagir.', 'err'); break; }
          const secret = prompt('JWT secret (server env: JWT_PUBLIC_SECRET):');
          if (!secret) { push('iptal.', 'err'); break; }
          const newToken = await forgeToken(tok, secret, { role: 'admin', clearance: 3 });
          push(`yeni token:\n${newToken}`, 'good');
          push('-> "elevate <token>" ile gonder.', 'sys');
          break;
        }

        case 'elevate': {
          const t = arg;
          if (!t) { push('kullanim: elevate <token>', 'err'); break; }
          const r = await api.elevate(t);
          if (r.ok) {
            setToken(r.body.token);
            push(`elevation ok. fragment=${r.body.fragment}`, 'good');
            await refreshStatus();
          } else {
            push(fmt('elevation hata', r.body), 'err');
          }
          break;
        }

        case 'cipher': {
          const r = await api.stage3();
          if (!r.ok) { push(fmt('stage3 hata', r.body), 'err'); break; }
          push(fmt('cipher paketi', r.body), 'data');
          push(`X-Salt: ${r.headers['x-salt']}  X-Info: ${r.headers['x-info']}`, 'hint');
          push('decrypt icin master AES key gerekli (env: AES_MASTER_KEY hex).', 'sys');
          break;
        }

        case 'decrypt': {
          const ct = arg;
          if (!ct) { push('kullanim: decrypt <ciphertext>', 'err'); break; }
          const masterHex = prompt('AES master key (hex):');
          if (!masterHex) { push('iptal.', 'err'); break; }
          const derivedHex = await hkdfSha256(masterHex, 'masterplan-stage3', 'cipher-channel');
          const plain = await aesGcmDecrypt(ct, derivedHex);
          push(`plaintext:\n${plain}`, 'good');
          const submit = await api.stage3Submit(plain);
          if (submit.ok) {
            push(fmt('stage3 cleared', submit.body), 'good');
            await refreshStatus();
          } else {
            push(fmt('submit hata', submit.body), 'err');
          }
          break;
        }

        case 'window': {
          const r = await api.stage4Window();
          push(fmt('race window', r.body), r.body.open ? 'good' : 'data');
          break;
        }

        case 'race': {
          push('window araniyor...', 'sys');
          let attempts = 0;
          const maxAttempts = 60;
          const tryOnce = async () => {
            attempts++;
            const w = await api.stage4Window();
            if (w.body.open) {
              const frags = ['ALPHA-7F2C', 'BRAVO-9E1A', 'CHARLIE-44D8'];
              const r = await api.stage4Attempt(frags);
              if (r.ok) {
                push(fmt('stage4 cleared', r.body), 'good');
                await refreshStatus();
              } else {
                push(fmt('attempt hata', r.body), 'err');
              }
              return true;
            }
            return false;
          };
          for (let i = 0; i < maxAttempts; i++) {
            const done = await tryOnce();
            if (done) break;
            await new Promise(r => setTimeout(r, 400));
          }
          break;
        }

        case 'unlock': {
          const key = ['ALPHA-7F2C', 'BRAVO-9E1A', 'CHARLIE-44D8', 'DELTA-0B5F'].join(':');
          const r = await api.vaultUnlock(key);
          if (r.ok) {
            push(fmt('VAULT', r.body), 'good');
            push('  ╔══════════════════════════════════════════════╗', 'banner');
            push(`  ║  FLAG: ${r.body.flag.padEnd(38)}║`, 'banner');
            push('  ╚══════════════════════════════════════════════╝', 'banner');
            await refreshStatus();
          } else {
            push(fmt('unlock hata', r.body), 'err');
          }
          break;
        }

        case 'status': {
          const r = await api.vaultStatus();
          if (r.ok) {
            setProgress(r.body.progress);
            setFragments(r.body.fragments || []);
            push(fmt('status', r.body), 'data');
          } else {
            push(fmt('status hata', r.body), 'err');
          }
          break;
        }

        default:
          push(`bilinmeyen komut: ${head}. "help" yaz.`, 'err');
      }
    } catch (e) {
      push(`hata: ${e.message}`, 'err');
    }
  }

  return (
    <div className="app">
      <div className="grid-bg"></div>
      <div className="scanlines"></div>
      <header className="topbar">
        <span className="brand">// MASTERPLAN</span>
        <span className="sep">::</span>
        <span className="role">{authed ? 'OPERATIVE_LINK_OK' : 'GUEST_LINK'}</span>
        <span className="sep">::</span>
        <span className="status-pill">{status}</span>
      </header>
      <main className="layout">
        <Terminal lines={lines} onCommand={handle} />
        <HUD progress={progress} fragments={fragments} status={status} />
      </main>
      <footer className="bottombar">
        <span>operasyon dort asama. her cevap header okunur. her saniye onemli.</span>
      </footer>
    </div>
  );
}
