const SOURCE = 'https://raw.githubusercontent.com/luchongky/thongkegiaingan/main/thu-chi/data.json';

export async function onRequestGet() {
  try {
    const upstream = await fetch(SOURCE, { headers: { Accept: 'application/json' }, cf: { cacheTtl: 300, cacheEverything: true } });
    if (!upstream.ok) throw new Error('source unavailable');
    const data = await upstream.json();
    if (!Array.isArray(data.xa) || !Array.isArray(data.khoan) || !/^\d{4}-\d{2}-\d{2}$/.test(data.ngay)) throw new Error('invalid source');
    return Response.json(data, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300', 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    return Response.json({ error: 'Chưa tải được số liệu từ nguồn. Vui lòng thử lại.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
