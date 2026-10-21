import { createError, getCookie, getHeader, type H3Event } from 'h3'
import { verifySession } from '../core/auth'
const buckets = new Map<string,{count:number,until:number}>()
export function userId(event: H3Event) {
  try {return verifySession(getCookie(event,'tarot_session') || '')}
  catch {throw createError({statusCode:401,statusMessage:'Откройте приложение через Telegram',data:{code:'AUTH_REQUIRED'}})}
}
export function sameOrigin(event: H3Event) {
  const origin=getHeader(event,'origin')
  if (!origin || origin !== new URL(process.env.APP_URL || 'http://localhost:3000').origin) throw createError({statusCode:403,statusMessage:'Недопустимый источник запроса'})
}
export function rateLimit(key: string,max=20) {
  const now=Date.now();let bucket=buckets.get(key)
  if(!bucket || bucket.until<now){bucket={count:0,until:now+60000};buckets.set(key,bucket)}
  if(++bucket.count>max) throw createError({statusCode:429,statusMessage:'Слишком много запросов. Попробуйте через минуту.'})
  if(buckets.size>10000) for(const [k,b] of buckets) if(b.until<now)buckets.delete(k)
}
export function publicFailure(error: unknown): never {
  const code=error instanceof Error?error.message:'SERVER_ERROR'
  const known:Record<string,[number,string]>={INSUFFICIENT_FUNDS:[409,'Недостаточно средств'],IDEMPOTENCY_CONFLICT:[409,'Этот запрос уже использован'],DATABASE_NOT_CONFIGURED:[503,'Сервис ещё не настроен'],SESSION_NOT_CONFIGURED:[503,'Авторизация ещё не настроена'],PAYMENTS_DISABLED:[503,'Пополнение пока недоступно'],PAYMENTS_NOT_CONFIGURED:[503,'Тестовые платежи ещё не настроены'],AI_NOT_CONFIGURED:[503,'Толкования пока недоступны'],INVALID_AUTH:[401,'Не удалось подтвердить вход'],EXPIRED_AUTH:[401,'Откройте приложение заново'],LIVE_PAYMENTS_FORBIDDEN:[503,'Разрешены только тестовые платежи']}
  const [statusCode,statusMessage]=known[code] || [502,'Сервис временно недоступен. Попробуйте позже.']
  throw createError({statusCode,statusMessage,data:{code:known[code]?code:'SERVICE_ERROR'}})
}
