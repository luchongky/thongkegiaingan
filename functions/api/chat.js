// Cloudflare Pages Function - proxy chatbot, không để lộ API key ra trình duyệt.
const ALLOWED_ORIGINS = ['https://thongkegiaingan.pages.dev'];
const API_BASE = 'https://codex.fosta.app/v1';

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
  return ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.some((site) => referer.startsWith(site));
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || '';
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    }});
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);
  if (!allowed(request)) return json({ error: 'Không có quyền truy cập chatbot' }, 403, origin);
  if (!env.FOSTA_API_KEY) return json({ error: 'Chưa cấu hình FOSTA_API_KEY trên Cloudflare Pages' }, 500, origin);

  let payload;
  try {
    const raw = await request.text();
    if (raw.length > 45000) return json({ error: 'Nội dung hội thoại quá dài' }, 413, origin);
    payload = JSON.parse(raw);
  } catch {
    return json({ error: 'Dữ liệu gửi lên không hợp lệ' }, 400, origin);
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  if (!messages.length || messages.length > 20) return json({ error: 'Lịch sử hội thoại không hợp lệ' }, 400, origin);
  const safeMessages = messages.map((message) => ({
    role: message.role === 'assistant' ? 'assistant' : message.role === 'system' ? 'system' : 'user',
    content: String(message.content || '').slice(0, 12000),
  }));
  const body = {
    model: env.FOSTA_MODEL || payload.model || 'gpt-6-luna',
    messages: safeMessages,
    temperature: 0.2,
    max_tokens: 900,
  };

  try {
    const upstream = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.FOSTA_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: 'API chatbot trả về dữ liệu không hợp lệ' }; }
    if (!upstream.ok) {
      return json({ error: data?.error?.message || data?.error || 'Không gọi được API chatbot' }, upstream.status >= 500 ? 502 : upstream.status, origin);
    }
    return json({ reply: data?.choices?.[0]?.message?.content || 'Mình chưa nhận được nội dung trả lời từ API.' }, 200, origin);
  } catch {
    return json({ error: 'Không kết nối được API chatbot' }, 502, origin);
  }
}
