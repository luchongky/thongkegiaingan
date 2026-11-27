import {BASE_LIMIT, limitFor, configured} from '../_lib/telegram-quota.js';
// Cloudflare Pages Function - proxy chatbot, không để lộ API key ra trình duyệt.
const ALLOWED_ORIGINS = ['https://thongkegiaingan.pages.dev', 'https://baocaothu56xa.pages.dev'];
const API_BASE = 'https://codex.fosta.app/v1';
const WEEKLY_LIMIT = BASE_LIMIT; const UNLIMITED = true; // true: không giới hạn lượt AI; đổi thành false để bật lại hạn mức tuần

function json(body, status = 200, origin = '') {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function allowed(request) {
  const origin = request.headers.get('Origin') || '';
  const referer = request.headers.get('Referer') || '';
  if (origin) return ALLOWED_ORIGINS.includes(origin);
  try {
    return ALLOWED_ORIGINS.includes(new URL(referer).origin);
  } catch {
    return false;
  }
}

function weekId() {
  const days = Math.floor(Date.now() / 86400000);
  return `w${Math.floor(days / 7)}`;
}

function resetAt() {
  const days = Math.floor(Date.now() / 86400000);
  return new Date((Math.floor(days / 7) + 1) * 7 * 86400000).toISOString();
}

async function consumeWeeklyLimit(request, env) {
  if (UNLIMITED) return { allowed: true, remaining: 999999, resetAt: resetAt() }; if (!env.CHAT_LIMITS) return { allowed: true, remaining: WEEKLY_LIMIT };
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'anonymous';
  const key = `${weekId()}:${ip.slice(0, 120)}`;
  const count = Number.parseInt(await env.CHAT_LIMITS.get(key) || '0', 10) || 0;
  const limit = await limitFor(env, key);
  if (count >= limit) return { allowed: false, remaining: 0, totalLimit: limit, resetAt: resetAt() };
  const next = count + 1;
  await env.CHAT_LIMITS.put(key, String(next), { expirationTtl: 8 * 86400 });
  return { allowed: true, remaining: limit - next, resetAt: resetAt() };
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || '';
  if (request.method === 'OPTIONS') {
    if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: 'Không có quyền truy cập chatbot' }, 403);

    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    }});
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);
  if (!allowed(request)) return json({ error: 'Không có quyền truy cập chatbot' }, 403, origin);
  if (![env.FOSTA_API_KEY, env.FOSTA_API_KEY_2, env.FOSTA_API_KEY_3, env.FOSTA_API_KEY_4].some((key) => typeof key === 'string' && key.trim())) return json({ error: 'Chưa cấu hình FOSTA_API_KEY trên Cloudflare Pages' }, 500, origin);

  let payload;
  try {
    const raw = await request.text();
    if (raw.length > 120000) return json({ error: 'Nội dung hội thoại quá dài' }, 413, origin);
    payload = JSON.parse(raw);
  } catch {
    return json({ error: 'Dữ liệu gửi lên không hợp lệ' }, 400, origin);
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  if (!messages.length || messages.length > 20) return json({ error: 'Lịch sử hội thoại không hợp lệ' }, 400, origin);
  const limit = await consumeWeeklyLimit(request, env);
  if (!limit.allowed) return json({ error: `Bạn đã dùng hết ${limit.totalLimit} lượt trong tuần này.`, code: 'WEEKLY_LIMIT', requestEnabled: configured(env) && limit.totalLimit === WEEKLY_LIMIT, remaining: 0, resetAt: limit.resetAt }, 429, origin);

  const safeMessages = messages.map((message) => ({
    role: message.role === 'assistant' ? 'assistant' : message.role === 'system' ? 'system' : 'user',
    content: String(message.content || '').slice(0, 110000),
  }));
  const body = {
    model: env.FOSTA_MODEL || payload.model || 'gpt-6-luna',
    messages: safeMessages,
    temperature: 0.2,
  };

  // Chọn ngẫu nhiên khóa bắt đầu, sau đó thử vòng qua các khóa còn lại đúng một lần.
  const keys = [...new Set([env.FOSTA_API_KEY, env.FOSTA_API_KEY_2, env.FOSTA_API_KEY_3, env.FOSTA_API_KEY_4]
    .filter((key) => typeof key === 'string' && key.trim()).map((key) => key.trim()))];
  const startIndex = Math.floor(Math.random() * keys.length);
  const orderedKeys = keys.slice(startIndex).concat(keys.slice(0, startIndex));
  let errorStatus = 502;
  const deadline = Date.now() + 95000; // Cloudflare cắt phản hồi sau ~100 giây
  for (let index = 0; index < orderedKeys.length; index++) {
    const remainingMs = deadline - Date.now();
    if (remainingMs < 5000) break;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(70000, remainingMs));
    try {
      const upstream = await fetch(`${API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${orderedKeys[index]}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!upstream.ok) {
        const retryable = [401, 402, 403, 408, 429].includes(upstream.status) || upstream.status >= 500;
        errorStatus = upstream.status >= 500 ? 502 : upstream.status;
        if (upstream.body) await upstream.body.cancel();
        if (retryable && index + 1 < orderedKeys.length) continue;
        break;
      }
      const data = await upstream.json();
      const reply = data?.choices?.[0]?.message?.content;
      if (typeof reply !== 'string' || !reply.trim()) {
        errorStatus = 502;
        continue;
      }
      return json({ reply, remaining: limit.remaining, resetAt: limit.resetAt }, 200, origin);
    } catch {
      errorStatus = 502;
    } finally {
      clearTimeout(timeout);
    }
  }
  return json({ error: 'API chatbot tạm thời không khả dụng. Vui lòng thử lại sau.', remaining: limit.remaining, resetAt: limit.resetAt }, errorStatus, origin);
}
