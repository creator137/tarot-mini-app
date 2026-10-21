import { database,transaction } from '../../core/db'
import { creditPayment } from '../../core/wallet'
import { yookassa } from '../../core/yookassa'
import { z } from 'zod'
export default defineEventHandler(async event=>{
  const uid=userId(event),id=getRouterParam(event,'id')
  if(!z.uuid().safeParse(id).success)throw createError({statusCode:400,statusMessage:'Некорректный номер платежа'})
  try {
    const p=(await database().query('SELECT * FROM payments WHERE id=$1 AND user_id=$2',[id,uid])).rows[0]
    if(!p) return {status:'not_found'}
    if(p.provider_id && p.status==='pending'){
      const remote=await yookassa(`payments/${p.provider_id}`)
      await transaction(db=>creditPayment(db,p.id,remote))
    }
    return {status:(await database().query('SELECT status FROM payments WHERE id=$1',[id])).rows[0].status}
  }catch(e){publicFailure(e)}
})
