import { database } from '../core/db'
export default defineEventHandler(async event=>{
  const id=userId(event)
  try {const {rows:[row]}=await database().query('SELECT u.id,u.first_name,w.balance,w.reserved FROM users u JOIN wallets w ON w.user_id=u.id WHERE u.id=$1',[id]);return row}
  catch(e){publicFailure(e)}
})
