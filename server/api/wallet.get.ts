import { database } from '../core/db'
export default defineEventHandler(async event=>{
  const uid=userId(event)
  try {return {wallet:(await database().query('SELECT balance,reserved FROM wallets WHERE user_id=$1',[uid])).rows[0],operations:(await database().query('SELECT id,kind,amount,reading_id,payment_id,created_at FROM ledger WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[uid])).rows}}
  catch(e){publicFailure(e)}
})
