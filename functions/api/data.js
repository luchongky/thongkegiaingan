// Cloudflare Pages Function - proxy bao ve API du lieu giai ngan. Tac gia: Luc Hong Ky - So Tai chinh tinh Cao Bang.
const ALLOWED_ORIGINS = ['https://thongkegiaingan.pages.dev'];
function jsonResponse(body, status, extra) { const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' }; if (extra) Object.assign(h, extra); return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: status, headers: h }); }
function isAllowed(request) { const origin = request.headers.get('Origin') || ''; const referer = request.headers.get('Referer') || ''; const site = request.headers.get('Sec-Fetch-Site') || ''; const mode = request.headers.get('Sec-Fetch-Mode') || ''; if (!site || !mode) return false; if (mode === 'navigate') return false; if (site === 'none') return false; if (site === 'same-origin' || site === 'same-site') { return referer === '' || ALLOWED_ORIGINS.some(function (o) { return referer.indexOf(o) === 0; }); } if (site === 'cross-site') { return ALLOWED_ORIGINS.indexOf(origin) !== -1; } return false; }
export async function onRequest(context) { const request = context.request; const env = context.env; if (request.method !== 'GET' && request.method !== 'HEAD') return jsonResponse({ error: 'Method not allowed' }, 405); if (!isAllowed(request)) return jsonResponse({ error: 'Khong co quyen truy cap du lieu' }, 403); if (!env.GAS_URL || !env.GAS_SECRET) return jsonResponse({ error: 'Chua cau hinh GAS_URL hoac GAS_SECRET' }, 500); const inUrl = new URL(request.url); const target = new URL(env.GAS_URL); target.searchParams.set('api', 'data'); if (inUrl.searchParams.get('nocache')) target.searchParams.set('nocache', '1'); target.searchParams.set('key', env.GAS_SECRET); let upstream; try { upstream = await fetch(target.toString(), { method: 'GET', redirect: 'follow', headers: { 'Accept': 'application/json' } }); } catch (err) { return jsonResponse({ error: 'Khong lay duoc du lieu' }, 502); } if (!upstream.ok) return jsonResponse({ error: 'Khong lay duoc du lieu' }, 502); const body = await upstream.text(); if (context.waitUntil) context.waitUntil(saveHistory(env, body)); const origin = request.headers.get('Origin') || ''; const extra = {}; if (origin && ALLOWED_ORIGINS.indexOf(origin) !== -1) { extra['Access-Control-Allow-Origin'] = origin; extra['Vary'] = 'Origin'; } return jsonResponse(body, 200, extra); }

// Luu so lieu tung ky vao KV (CHAT_LIMITS) de chatbot so sanh xu huong nhieu ky. Tac gia: Luc Hong Ky.
const HIST_TTL = 400 * 86400;
function periodKey(key, label) {
  const k = String(key || ''); if (/^\d{4}-\d{2}-\d{2}$/.test(k)) return k;
  const m = String(label || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : '';
}
function pairAll(p) { const a = p && p.all; return Array.isArray(a) && a.length >= 2 && isFinite(+a[0]) && isFinite(+a[1]) ? [Math.round(+a[0] * 1000) / 1000, Math.round(+a[1] * 1000) / 1000] : null; }
async function putPeriod(env, key, label, final, rows) {
  const k = periodKey(key, label); if (!k || !rows.length) return;
  const id = 'hist:' + k;
  const old = await env.CHAT_LIMITS.get(id, 'json');
  if (old && old.final && !final) return;
  if (old && !final && old.savedAt && Date.now() - Date.parse(old.savedAt) < 300000) return;
  await env.CHAT_LIMITS.put(id, JSON.stringify({ key: k, label: label || k, final: !!final, savedAt: new Date().toISOString(), units: rows }), { expirationTtl: HIST_TTL });
}
async function saveHistory(env, body) {
  try {
    if (!env.CHAT_LIMITS) return;
    const data = JSON.parse(body); if (!data || data.ok !== true || !Array.isArray(data.units)) return;
    const cur = [], prev = [];
    data.units.forEach((u, i) => {
      if (!u || typeof u !== 'object') return;
      const id = u.id == null || u.id === '' ? 'row-' + i : String(u.id);
      const c = pairAll(u.p), p = pairAll(u.prev);
      if (c) cur.push([id, c[0], c[1], u.status || null]);
      if (p) prev.push([id, p[0], p[1], u.prevStatus || null]);
    });
    if (data.period && data.period.label) await putPeriod(env, data.period.key, data.period.label, false, cur);
    if (data.prevPeriod && data.prevPeriod.label) await putPeriod(env, data.prevPeriod.key, data.prevPeriod.label, data.prevPeriod.official === true, prev);
  } catch (e) {}
}
