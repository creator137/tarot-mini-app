import { z } from 'zod'
import { verifyInitData, signSession } from '../core/auth'
import { transaction } from '../core/db'
export default defineEventHandler(async event=>{
  sameOrigin(event);rateLimit(`auth:${getRequestIP(event)}`,30)
  const parsed=z.object({initData:z.string().min(1).max(16000)}).safeParse(await readBody(event))
  if(!parsed.success)throw createError({statusCode:400,statusMessage:'Некорректные данные входа'})
  try {
    const token=process.env.BOT_TOKEN;if(!token)throw new Error('SESSION_NOT_CONFIGURED')
    const user=verifyInitData(parsed.data.initData,token)
    const session=signSession(user.id)
    await transaction(async db=>{
      await db.query('INSERT INTO users(id,first_name) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET first_name=EXCLUDED.first_name',[user.id,user.first_name])
      await db.query('INSERT INTO wallets(user_id) VALUES($1) ON CONFLICT DO NOTHING',[user.id])
    })
    setCookie(event,'tarot_session',session,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:86400,path:'/'})
    return {user}
  }catch(e){publicFailure(e)}
})
