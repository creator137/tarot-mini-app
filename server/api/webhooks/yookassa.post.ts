import { z } from 'zod'
import { database,transaction } from '../../core/db'
import { yookassa } from '../../core/yookassa'
import { creditPayment } from '../../core/wallet'
export default defineEventHandler(async event=>{
  const body=z.object({object:z.object({id:z.string().regex(/^[a-zA-Z0-9-]{1,80}$/)})}).safeParse(await readBody(event))
  if(!body.success)throw createError({statusCode:400})
  try {
    const p=(await database().query('SELECT id FROM payments WHERE provider_id=$1',[body.data.object.id])).rows[0]
    if(!p)return {ok:true}
    const remote=await yookassa(`payments/${body.data.object.id}`)
    await transaction(db=>creditPayment(db,p.id,remote));return {ok:true}
  }catch{throw createError({statusCode:503,statusMessage:'Повторите доставку уведомления'})}
})
