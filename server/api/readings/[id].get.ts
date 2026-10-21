import { database } from '../../core/db'
import { z } from 'zod'
export default defineEventHandler(async event=>{
  const uid=userId(event),id=getRouterParam(event,'id')
  if(!z.uuid().safeParse(id).success)throw createError({statusCode:400,statusMessage:'Некорректный номер расклада'})
  let row
  try {row=(await database().query('SELECT id,question,count,price,cards,status,result,error_code,created_at FROM readings WHERE user_id=$1 AND id=$2',[uid,id])).rows[0]}
  catch(e){publicFailure(e)}
  if(!row)throw createError({statusCode:404,statusMessage:'Расклад не найден'})
  return row
})
