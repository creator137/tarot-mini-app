import { z } from 'zod'
import { randomInt } from 'node:crypto'
import { cards } from '../../../shared/data/cards'
import { transaction } from '../../core/db'
import { reserveReading } from '../../core/wallet'
export default defineEventHandler(async event=>{
  sameOrigin(event);const id=userId(event);rateLimit(`reading:${id}`,6)
  const parsed=z.object({key:z.uuid(),question:z.string().trim().min(5).max(600),count:z.union([z.literal(1),z.literal(3)])}).safeParse(await readBody(event))
  if(!parsed.success)throw createError({statusCode:400,statusMessage:'Введите вопрос от 5 до 600 символов'})
  try {
    if(!process.env.DEEPSEEK_API_KEY)throw new Error('AI_NOT_CONFIGURED')
    const pool=[...cards]; const drawn=Array.from({length:parsed.data.count},(_,i)=>({id:pool.splice(randomInt(pool.length),1)[0]!.id,reversed:randomInt(2)===1,position:parsed.data.count===1?'Главное для вас':['Ситуация','Что влияет','Совет'][i]}))
    const r=await transaction(db=>reserveReading(db,{userId:id,...parsed.data,cards:drawn}))
    return {id:r.id,status:r.status}
  }catch(e){publicFailure(e)}
})
