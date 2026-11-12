// Login no servidor: usuários em AUTH_USERS (JSON com hash scrypt), sessão em cookie httpOnly assinado.
import crypto from 'node:crypto';

const COOKIE = 'ss_session';
const REMEMBER_S = 30 * 24 * 3600;
const SESSION_S = 8 * 3600;

const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET ausente ou curto (mínimo 32 caracteres).');
  return s;
};

// AUTH_USERS aceita JSON puro ou o mesmo JSON em base64 (útil quando o painel da hospedagem altera aspas ou "$")
export function users() {
  const raw = (process.env.AUTH_USERS || '').trim();
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { /* tenta base64 */ }
  try { return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')); } catch { return []; }
}

// Formato do hash: scrypt$<sal hex>$<hash hex>  (gerado por scripts/hash-password.mjs)
export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}
function verify(password, stored) {
  const [kind, salt, hex] = String(stored).split('$');
  if (kind !== 'scrypt' || !salt || !hex) return false;
  const a = Buffer.from(hex, 'hex');
  const b = crypto.scryptSync(password, salt, a.length);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', secret()).update(data).digest('base64url');

function makeToken(user, remember) {
  const body = b64(JSON.stringify({ u: user.username, n: user.name, exp: Date.now() + (remember ? REMEMBER_S : SESSION_S) * 1000 }));
  return `${body}.${sign(body)}`;
}
export function readSession(req) {
  const raw = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const [body, sig] = raw.split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const s = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (s.exp < Date.now() || !users().some((u) => u.username === s.u)) return null;
    return { username: s.u, name: s.n };
  } catch { return null; }
}

const secure = (req) => req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
const cookie = (req, value, maxAge) => `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure(req) ? '; Secure' : ''}`;

// Limite simples de tentativas por IP (memória do processo)
const attempts = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  attempts.set(ip, list);
  return list.length >= 10;
}

export async function login(req, res, body, send) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  if (limited(ip)) return send(429, { error: 'Muitas tentativas. Aguarde 15 minutos.' });
  const username = String(body?.username || '').trim().toLowerCase();
  const user = users().find((u) => u.username === username);
  if (!user || !verify(String(body?.password || ''), user.hash)) {
    attempts.get(ip).push(Date.now());
    return send(401, { error: 'Usuário ou senha incorretos.' });
  }
  attempts.delete(ip);
  const remember = !!body?.remember;
  res.setHeader('Set-Cookie', cookie(req, makeToken(user, remember), remember ? REMEMBER_S : SESSION_S));
  send(200, { name: user.name, username: user.username });
}

export function logout(req, res, send) {
  res.setHeader('Set-Cookie', cookie(req, '', 0));
  send(200, { ok: true });
}
