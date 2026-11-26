import {limitFor, configured} from '../_lib/telegram-quota.js';
// Cloudflare Pages Function - proxy chatbot, không để lộ API key ra trình duyệt.
const ALLOWED_ORIGINS = ['https://thongkegiaingan.pages.dev'];
const API_BASE = 'https://codex.fosta.app/v1';
const WEEKLY_LIMIT = 20;
const ANALYSIS_INSTRUCTIONS = 'Bạn là Trợ lý giải ngân của Sở Tài chính tỉnh Cao Bằng. Trả lời bằng tiếng Việt, phân tích sâu, rõ ràng và có căn cứ. Với yêu cầu đánh giá, trình bày: kết luận chính; số liệu và phép so sánh; rủi ro và nguyên nhân cần xác minh; giải pháp ưu tiên, đầu mối và mốc thời gian đề xuất. Không chỉ liệt kê số liệu. Phân biệt dữ kiện, suy luận và kiến nghị; không tự khẳng định nguyên nhân chưa được cung cấp. Nêu kỳ báo cáo, nguồn, đơn vị triệu đồng, trạng thái số liệu tạm tính/chưa gửi. Không bịa số liệu, văn bản pháp luật hoặc so sánh kỳ trước khi thiếu dữ liệu. Chỉ hỗ trợ tra cứu và nhiệm vụ liên quan giải ngân. Câu hỏi phân tích cần giải thích đầy đủ, thông thường 600–1000 từ khi dữ liệu đủ; câu hỏi đơn giản trả lời tương xứng, không kéo dài máy móc. Dùng tiêu đề ngắn và các đoạn dễ đọc; tỷ lệ làm tròn một chữ số thập phân.';


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

function weekId() {
  const days = Math.floor(Date.now() / 86400000);
  return `w${Math.floor(days / 7)}`;
}

function resetAt() {
  const days = Math.floor(Date.now() / 86400000);
  return new Date((Math.floor(days / 7) + 1) * 7 * 86400000).toISOString();
}

async function consumeWeeklyLimit(request, env) {
  if (!env.CHAT_LIMITS) return { allowed: true, remaining: WEEKLY_LIMIT };
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
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    }});
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);
  if (!allowed(request)) return json({ error: 'Không có quyền truy cập chatbot' }, 403, origin);
  if (![env.XINGCHI_API_KEY, env.FOSTA_API_KEY, env.FOSTA_API_KEY_2, env.FOSTA_API_KEY_3, env.FOSTA_API_KEY_4].some((key) => typeof key === 'string' && key.trim())) return json({ error: 'Chưa cấu hình API chatbot trên Cloudflare Pages' }, 500, origin);

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
    content: String(message.content || '').slice(0, 40000),
  }));
  const body = {
    model: env.FOSTA_MODEL || 'gpt-6-luna',
    messages: [...safeMessages, { role: 'system', content: ANALYSIS_INSTRUCTIONS }],
    temperature: 0.2,
    max_tokens: 6000,
  };

  // Chọn ngẫu nhiên khóa bắt đầu, sau đó thử vòng qua các khóa còn lại đúng một lần.
  const keys = [...new Set([env.FOSTA_API_KEY, env.FOSTA_API_KEY_2, env.FOSTA_API_KEY_3, env.FOSTA_API_KEY_4]
    .filter((key) => typeof key === 'string' && key.trim()).map((key) => key.trim()))];
  const startIndex = Math.floor(Math.random() * keys.length);
  const orderedKeys = keys.slice(startIndex).concat(keys.slice(0, startIndex));
  const attempts = orderedKeys.map(key => ({ key, url: `${API_BASE}/chat/completions`, body }));
  if (typeof env.XINGCHI_API_KEY === 'string' && env.XINGCHI_API_KEY.trim()) {
    attempts.unshift({
      key: env.XINGCHI_API_KEY.trim(),
      url: 'https://api.xingchiapi.com/v1/responses',
      responses: true,
      body: {
        model: env.XINGCHI_MODEL || 'gpt-6.1-sol',
        instructions: ANALYSIS_INSTRUCTIONS,
        input: safeMessages.map(message => ({ ...message, role: message.role === 'system' ? 'user' : message.role })),
        max_output_tokens: 8000,
        store: false,
      },
    });
  }
  let errorStatus = 502;
  for (let index = 0; index < attempts.length; index++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), attempts[index].responses ? 90000 : 45000);
    try {
      const upstream = await fetch(attempts[index].url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${attempts[index].key}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(attempts[index].body),
        signal: controller.signal,
      });
      if (!upstream.ok) {
        const retryable = [401, 402, 403, 408, 429].includes(upstream.status) || upstream.status >= 500;
        errorStatus = upstream.status >= 500 ? 502 : upstream.status;
        if (upstream.body) await upstream.body.cancel();
        if ((retryable || attempts[index].responses) && index + 1 < attempts.length) continue;
        break;
      }
      const data = await upstream.json();
      const reply = attempts[index].responses
        ? (data.output_text || (data.output || []).filter(item => item.type === 'message').flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text || '').join('\n'))
        : data?.choices?.[0]?.message?.content;
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
