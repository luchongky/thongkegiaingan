// TẠM THỜI: thử API đọc giọng nói, sẽ xoá ngay sau khi thử
const API_BASE = 'https://codex.fosta.app/v1';
export async function onRequest({ request, env }) {
  const h = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Content-Type': 'application/json' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (request.headers.get('x-probe') !== 'a92efe7b6fd64947efccfb62') return new Response('{}', { status: 403, headers: h });
  const key = [env.FOSTA_API_KEY, env.FOSTA_API_KEY_2, env.FOSTA_API_KEY_3, env.FOSTA_API_KEY_4].find((k) => typeof k === 'string' && k.trim());
  const out = { models: null, tests: [] };
  try {
    const r = await fetch(API_BASE + '/models', { headers: { Authorization: 'Bearer ' + key.trim() } });
    const j = await r.json().catch(() => null);
    out.modelsStatus = r.status;
    out.models = j && j.data ? j.data.map((m) => m.id) : null;
  } catch (e) { out.modelsErr = String(e).slice(0, 120); }
  for (const model of ['tts-1', 'gpt-4o-mini-tts']) {
    try {
      const r = await fetch(API_BASE + '/audio/speech', { method: 'POST', headers: { Authorization: 'Bearer ' + key.trim(), 'Content-Type': 'application/json' }, body: JSON.stringify({ model, voice: 'alloy', input: 'Xin chào, đây là bản thử giọng đọc báo cáo giải ngân.' }) });
      const buf = await r.arrayBuffer();
      const ct = r.headers.get('content-type') || '';
      out.tests.push({ model, status: r.status, ct, bytes: buf.byteLength, err: /json|text/.test(ct) ? new TextDecoder().decode(buf).slice(0, 200) : null });
    } catch (e) { out.tests.push({ model, err: String(e).slice(0, 120) }); }
  }
  return new Response(JSON.stringify(out), { headers: h });
}
