import { database } from '../../core/db'
export default defineEventHandler(async event=>{
  const id=userId(event)
  try {return (await database().query('SELECT id,question,count,price,cards,status,created_at FROM readings WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[id])).rows}
  catch(e){publicFailure(e)}
})
