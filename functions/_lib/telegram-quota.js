export const BASE_LIMIT = 50;
export const EXTRA_LIMIT = 20;
export const TTL = 8 * 86400;
export const SITE = 'https://thongkegiaingan.pages.dev';
export const weekId = () => `w${Math.floor(Date.now() / (7 * 86400000))}`;
export function quotaKey(request) {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'anonymous';
  return `${weekId()}:${ip.slice(0, 120)}`;
}
export async function limitFor(env, key) {
  return BASE_LIMIT + (await env.CHAT_LIMITS?.get('grant:' + key) === '20' ? EXTRA_LIMIT : 0);
}
export function reply(data, status = 200) {
  return new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
export function sameSite(request) {
  if (request.headers.get('Origin')) return request.headers.get('Origin') === SITE;
  try { return new URL(request.headers.get('Referer')).origin === SITE; } catch { return false; }
}
export function configured(env) {
  return !!(env.CHAT_LIMITS && env.TELEGRAM_BOT_TOKEN && /^-?\d+$/.test(env.TELEGRAM_CHAT_ID || '') && /^\d+$/.test(env.TELEGRAM_ADMIN_ID || env.TELEGRAM_CHAT_ID || ''));
}
export async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2,'0')).join('');
}
export const webhookSecret = env => digest('giaingan-webhook:' + env.TELEGRAM_BOT_TOKEN);
export async function telegram(env, method, data) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(12000)
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error('Telegram request failed');
    return result.result;
  } catch { throw new Error('Không kết nối được Telegram'); }
}
