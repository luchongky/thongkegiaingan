import {TTL, configured, reply, telegram, webhookSecret, weekId} from '../_lib/telegram-quota.js';

export async function onRequest({request,env}) {
  if(request.method!=='POST')return reply({error:'Method not allowed'},405);
  if(!configured(env) || request.headers.get('X-Telegram-Bot-Api-Secret-Token')!==await webhookSecret(env))return reply({error:'Forbidden'},403);
  let update;
  try {const raw=await request.text();if(raw.length>64000)return reply({error:'Too large'},413);update=JSON.parse(raw);}catch{return reply({error:'Invalid request'},400);}
  const q=update.callback_query;
  if(!q)return reply({ok:true});
  const admin=String(env.TELEGRAM_ADMIN_ID || env.TELEGRAM_CHAT_ID);
  if(String(q.from?.id)!==admin || String(q.message?.chat?.id)!==String(env.TELEGRAM_CHAT_ID))return reply({ok:true});
  const match=/^quota:([ar]):([a-f0-9]{32})$/.exec(q.data || '');
  if(!match)return reply({ok:true});
  const recordKey='request:'+match[2];
  const record=JSON.parse(await env.CHAT_LIMITS.get(recordKey)||'null');
  let result='Yêu cầu không còn hiệu lực.';
  if(record && record.week===weekId() && record.messageId===q.message.message_id){
    const granted=await env.CHAT_LIMITS.get('grant:'+record.key)==='20';
    if(granted || record.status==='approved')result='Yêu cầu đã được duyệt +20 lượt.';
    else if(record.status==='rejected')result='Yêu cầu đã bị từ chối.';
    else if(record.status==='pending'){
      if(match[1]==='a'){
        // Absolute grant makes webhook retries idempotent; never increment it.
        await env.CHAT_LIMITS.put('grant:'+record.key,'20',{expirationTtl:TTL});
        record.status='approved';result='Đã duyệt +20 lượt đến hết kỳ hiện tại.';
      }else{record.status='rejected';result='Đã từ chối yêu cầu.';}
      await env.CHAT_LIMITS.put(recordKey,JSON.stringify(record),{expirationTtl:TTL});
    }
  }
  await telegram(env,'answerCallbackQuery',{callback_query_id:q.id,text:result,show_alert:true}).catch(()=>{});
  if(record && ['approved','rejected'].includes(record.status)){
    await telegram(env,'editMessageReplyMarkup',{chat_id:env.TELEGRAM_CHAT_ID,message_id:record.messageId,reply_markup:{inline_keyboard:[]}}).catch(()=>{});
  }
  return reply({ok:true});
}
