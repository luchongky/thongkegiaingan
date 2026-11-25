import {BASE_LIMIT, TTL, quotaKey, limitFor, reply, sameSite, configured, digest, telegram, weekId} from '../_lib/telegram-quota.js';

export async function onRequest({request,env}) {
  if (!['GET','POST'].includes(request.method)) return reply({error:'Method not allowed'},405);
  if (!sameSite(request)) return reply({error:'Không có quyền truy cập'},403);
  if (!configured(env)) return reply({error:'Chức năng đề nghị tăng hạn mức chưa được cấu hình.'},503);
  const key = quotaKey(request);
  const id = (await digest('quota-request:' + key + ':' + env.TELEGRAM_BOT_TOKEN)).slice(0,32);
  const recordKey = 'request:' + id;
  const count = Number.parseInt(await env.CHAT_LIMITS.get(key) || '0',10) || 0;
  const limit = await limitFor(env,key);
  const existing = JSON.parse(await env.CHAT_LIMITS.get(recordKey) || 'null');
  if (request.method === 'GET') return reply({status:limit>BASE_LIMIT?'approved':existing?.status || 'none',remaining:Math.max(0,limit-count),limit});
  if (count < BASE_LIMIT) return reply({error:'Bạn vẫn còn lượt sử dụng trong tuần.'},409);
  if (limit > BASE_LIMIT) return reply({error:'Bạn đã được tăng thêm 20 lượt trong tuần này.',status:'approved',remaining:Math.max(0,limit-count)},409);
  if (existing && existing.status !== 'failed') return reply({status:existing.status});
  if (existing && Date.now()-existing.createdAt<60000) return reply({error:'Vui lòng chờ một phút trước khi gửi lại.'},429);
  let body;
  try {const raw=await request.text();if(raw.length>3000)return reply({error:'Nội dung quá dài'},413);body=JSON.parse(raw);} catch {return reply({error:'Dữ liệu không hợp lệ'},400);}
  const name=String(body.name||'').trim(),unit=String(body.unit||'').trim(),reason=String(body.reason||'').trim();
  if (!name || name.length>80 || !unit || unit.length>120 || !reason || reason.length>500) return reply({error:'Vui lòng nhập tên, đơn vị và lý do hợp lệ.'},400);
  const record={id,key,week:weekId(),status:'sending',createdAt:Date.now()};
  await env.CHAT_LIMITS.put(recordKey,JSON.stringify(record),{expirationTtl:TTL});
  try {
    const message=await telegram(env,'sendMessage',{chat_id:env.TELEGRAM_CHAT_ID,text:`ĐỀ NGHỊ TĂNG HẠN MỨC AI\nNgười đề nghị: ${name}\nĐơn vị: ${unit}\nLý do: ${reason}\nĐã dùng: ${count}/20 lượt\nĐề nghị: thêm 20 lượt đến hết kỳ hiện tại.\nLưu ý: hạn mức hiện tính theo địa chỉ mạng (IP), có thể dùng chung trong cùng cơ quan.`,reply_markup:{inline_keyboard:[[{text:'Duyệt +20 lượt',callback_data:'quota:a:'+id},{text:'Từ chối',callback_data:'quota:r:'+id}]]}});
    record.status='pending';record.messageId=message.message_id;
    await env.CHAT_LIMITS.put(recordKey,JSON.stringify(record),{expirationTtl:TTL});
    return reply({status:'pending'});
  } catch {
    record.status='failed';await env.CHAT_LIMITS.put(recordKey,JSON.stringify(record),{expirationTtl:TTL});
    return reply({error:'Chưa gửi được yêu cầu. Vui lòng thử lại sau một phút.'},502);
  }
}
