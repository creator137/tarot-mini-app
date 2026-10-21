import { timingSafeEqual } from 'node:crypto'
export default defineEventHandler(async event=>{
  const expected=process.env.TELEGRAM_WEBHOOK_SECRET,actual=getHeader(event,'x-telegram-bot-api-secret-token') || ''
  if(!expected || expected.length!==actual.length || !timingSafeEqual(Buffer.from(expected),Buffer.from(actual)))throw createError({statusCode:403})
  const update=await readBody(event),message=update?.message
  if(!message?.chat?.id || typeof message.text!=='string')return {ok:true}
  const command=message.text.split(/\s/)[0].split('@')[0]
  if(!['/start','/help','/support','/terms'].includes(command))return {ok:true}
  const url=process.env.APP_URL
  if(!url?.startsWith('https://'))throw createError({statusCode:503,statusMessage:'APP_URL must use HTTPS'})
  const text=command==='/start'?'Расклад онлайн ✦\nЗадайте свой вопрос и найдите новый взгляд на ситуацию. Одна карта — 50 ₽, три карты — 100 ₽.': 'Условия, помощь и история операций доступны в приложении. Таро — инструмент размышления, а не гарантия будущих событий.'
  const response=await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:message.chat.id,text,reply_markup:{inline_keyboard:[[{text:'Открыть приложение',web_app:{url}}]]}}),signal:AbortSignal.timeout(10000)})
  if(!response.ok)throw createError({statusCode:503,statusMessage:'Telegram unavailable'})
  return {ok:true}
})
