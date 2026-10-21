import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { database, transaction } from '../../core/db'
import { paymentConfig,yookassa } from '../../core/yookassa'
export default defineEventHandler(async event=>{
  sameOrigin(event);const uid=userId(event);rateLimit(`payment:${uid}`,10)
  const p=z.object({key:z.uuid(),amount:z.number().int().min(5000).max(1000000)}).safeParse(await readBody(event))
  if(!p.success)throw createError({statusCode:400,statusMessage:'Сумма пополнения: от 50 до 10 000 ₽'})
  try {
    paymentConfig()
    const payment=await transaction(async db=>{
      await db.query('SELECT user_id FROM wallets WHERE user_id=$1 FOR UPDATE',[uid])
      const existing=(await db.query('SELECT * FROM payments WHERE user_id=$1 AND request_key=$2',[uid,p.data.key])).rows[0]
      if(existing){if(existing.amount!==p.data.amount)throw new Error('IDEMPOTENCY_CONFLICT');return existing}
      return (await db.query('INSERT INTO payments(id,user_id,request_key,amount) VALUES($1,$2,$3,$4) RETURNING *',[randomUUID(),uid,p.data.key,p.data.amount])).rows[0]
    })
    if(payment.confirmation_url)return {id:payment.id,url:payment.confirmation_url}
    // After the provider idempotency window expires, require reconciliation, never create another charge.
    if(Date.now()-new Date(payment.created_at).getTime()>23*3600000)throw new Error('PAYMENT_RECONCILIATION_REQUIRED')
    const remote=await yookassa('payments',{amount:{value:(payment.amount/100).toFixed(2),currency:'RUB'},capture:true,confirmation:{type:'redirect',return_url:`${process.env.APP_URL}/?payment=${payment.id}`},description:'Пополнение баланса «Расклад онлайн» (тест)',metadata:{payment_id:payment.id}},payment.id)
    const url=remote.confirmation?.confirmation_url
    if(!url || new URL(url).protocol!=='https:')throw new Error('PAYMENT_PROVIDER_ERROR')
    await database().query('UPDATE payments SET provider_id=$2,confirmation_url=$3,test=true WHERE id=$1',[payment.id,remote.id,url])
    return {id:payment.id,url}
  }catch(e){publicFailure(e)}
})
