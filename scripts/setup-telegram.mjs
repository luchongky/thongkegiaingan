import {createHash} from 'node:crypto';
const token=process.env.TELEGRAM_BOT_TOKEN;
if(process.env.CF_PAGES_BRANCH!=='main' || !token || !process.env.TELEGRAM_CHAT_ID){
  console.log('Telegram setup skipped: production configuration not ready.');
}else{
  const target='https://thongkegiaingan.pages.dev/api/telegram-webhook';
  async function call(method,data={}){
    try{
      const response=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(15000)});
      const result=await response.json();if(!response.ok||!result.ok)throw new Error();return result.result;
    }catch{throw new Error('Telegram setup failed; verify bot configuration.');}
  }
  const info=await call('getWebhookInfo');
  if(info.url && info.url!==target)throw new Error('Bot already has a different webhook. Use a dedicated bot; existing webhook was not changed.');
  await call('setWebhook',{url:target,secret_token:createHash('sha256').update('giaingan-webhook:'+token).digest('hex'),allowed_updates:['callback_query'],max_connections:1,drop_pending_updates:false});
  console.log('Telegram approval webhook configured.');
}
