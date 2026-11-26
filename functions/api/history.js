// Cloudflare Pages Function - tra ve so lieu cac ky da luu de so sanh xu huong. Tac gia: Luc Hong Ky.
const ALLOWED_ORIGINS = ['https://thongkegiaingan.pages.dev'];
function jsonResponse(body, status, extra) { const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' }; if (extra) Object.assign(h, extra); return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: status, headers: h }); }
function isAllowed(request) { const origin = request.headers.get('Origin') || ''; const referer = request.headers.get('Referer') || ''; const site = request.headers.get('Sec-Fetch-Site') || ''; const mode = request.headers.get('Sec-Fetch-Mode') || ''; if (!site || !mode) return false; if (mode === 'navigate') return false; if (site === 'none') return false; if (site === 'same-origin' || site === 'same-site') { return referer === '' || ALLOWED_ORIGINS.some(function (o) { return referer.indexOf(o) === 0; }); } if (site === 'cross-site') { return ALLOWED_ORIGINS.indexOf(origin) !== -1; } return false; }
export async function onRequest(context) {
  const request = context.request, env = context.env;
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);
  if (!isAllowed(request)) return jsonResponse({ error: 'Khong co quyen truy cap du lieu' }, 403);
  if (!env.CHAT_LIMITS) return jsonResponse({ ok: true, periods: [] }, 200);
  try {
    const listed = await env.CHAT_LIMITS.list({ prefix: 'hist:' });
    const names = listed.keys.map(k => k.name).sort().slice(-12);
    const periods = (await Promise.all(names.map(n => env.CHAT_LIMITS.get(n, 'json')))).filter(Boolean);
    return jsonResponse({ ok: true, periods }, 200);
  } catch (e) { return jsonResponse({ ok: true, periods: [] }, 200); }
}
