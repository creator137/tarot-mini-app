// Run only after APP_URL is an owned HTTPS deployment ready for Telegram testing.
const token=process.env.BOT_TOKEN,url=process.env.APP_URL,secret=process.env.TELEGRAM_WEBHOOK_SECRET
if(!token||!url?.startsWith('https://')||!secret){console.error('BOT_TOKEN, HTTPS APP_URL and TELEGRAM_WEBHOOK_SECRET are required.');process.exit(1)}
async function call(method,body){const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const b=await r.json();if(!b.ok)throw new Error(`Telegram ${method} failed`)}
try{
 await call('setChatMenuButton',{menu_button:{type:'web_app',text:'Расклад',web_app:{url}}})
 await call('setWebhook',{url:`${url.replace(/\/$/,'')}/api/webhooks/telegram`,secret_token:secret,allowed_updates:['message']})
 console.log('Telegram menu and webhook configured. No messages sent.')
}catch{console.error('Telegram configuration failed. Verify the HTTPS deployment and settings.');process.exitCode=1}
