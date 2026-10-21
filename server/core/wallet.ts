import { randomUUID } from 'node:crypto'
import type { DB } from './db'
import { cardsVersion } from '../../shared/data/cards'
export const prices = { 1: 5000, 3: 10000 } as const
export async function reserveReading(db: DB, input: { userId: string, key: string, question: string, count: 1|3, cards: any[] }) {
  const { rows: [wallet] } = await db.query('SELECT * FROM wallets WHERE user_id=$1 FOR UPDATE',[input.userId])
  if (!wallet) throw new Error('WALLET_NOT_FOUND')
  const { rows: [existing] } = await db.query('SELECT * FROM readings WHERE user_id=$1 AND request_key=$2',[input.userId,input.key])
  if (existing) {
    if (existing.question !== input.question || existing.count !== input.count) throw new Error('IDEMPOTENCY_CONFLICT')
    return existing
  }
  const price = prices[input.count]
  if (wallet.balance-wallet.reserved < price) throw new Error('INSUFFICIENT_FUNDS')
  const id=randomUUID()
  const { rows:[reading] } = await db.query(`INSERT INTO readings(id,user_id,request_key,question,count,price,cards,status) VALUES($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING *`,[id,input.userId,input.key,input.question,input.count,price,JSON.stringify(input.cards)])
  await db.query('UPDATE readings SET catalog_version=$2 WHERE id=$1',[id,cardsVersion])
  await db.query('UPDATE wallets SET reserved=reserved+$2 WHERE user_id=$1',[input.userId,price])
  await db.query(`INSERT INTO ledger(id,user_id,kind,amount,reading_id,operation_key) VALUES($1,$2,'hold',$3,$4,$5)`,[randomUUID(),input.userId,price,id,`hold:${id}`])
  return reading
}
export async function settleReading(db: DB, id: string, lease: string, result: unknown, model: string) {
  const {rows:[reading]}=await db.query('SELECT * FROM readings WHERE id=$1 FOR UPDATE',[id])
  if (!reading || reading.status !== 'processing' || reading.lease_token !== lease) return false
  await db.query('UPDATE wallets SET balance=balance-$2,reserved=reserved-$2 WHERE user_id=$1',[reading.user_id,reading.price])
  await db.query(`INSERT INTO ledger(id,user_id,kind,amount,reading_id,operation_key) VALUES($1,$2,'charge',$3,$4,$5)`,[randomUUID(),reading.user_id,reading.price,id,`charge:${id}`])
  await db.query(`UPDATE readings SET status='completed',result=$2,model=$3,completed_at=now(),lease_token=NULL,lease_until=NULL WHERE id=$1`,[id,JSON.stringify(result),model])
  return true
}
export async function failReading(db: DB,id: string,lease: string) {
  const {rows:[r]}=await db.query('SELECT * FROM readings WHERE id=$1 FOR UPDATE',[id])
  if (!r || r.status !== 'processing' || r.lease_token !== lease) return false
  if (r.attempts < 3) {
    await db.query(`UPDATE readings SET status='pending',lease_token=NULL,lease_until=NULL,next_attempt_at=now()+interval '20 seconds',error_code='GENERATION_RETRY' WHERE id=$1`,[id]); return true
  }
  await db.query('UPDATE wallets SET reserved=reserved-$2 WHERE user_id=$1',[r.user_id,r.price])
  await db.query(`INSERT INTO ledger(id,user_id,kind,amount,reading_id,operation_key) VALUES($1,$2,'release',$3,$4,$5)`,[randomUUID(),r.user_id,r.price,id,`release:${id}`])
  await db.query(`UPDATE readings SET status='failed',lease_token=NULL,lease_until=NULL,error_code='GENERATION_FAILED' WHERE id=$1`,[id]); return true
}
export async function creditPayment(db: DB,id: string,provider: {id:string, status:string, test:boolean, amount:{value:string,currency:string},metadata?:{payment_id?:string}}) {
  const {rows:[p]}=await db.query('SELECT * FROM payments WHERE id=$1 FOR UPDATE',[id])
  if (!p || provider.id !== p.provider_id || provider.metadata?.payment_id !== p.id || !provider.test || provider.amount.currency !== 'RUB' || provider.amount.value !== (p.amount/100).toFixed(2)) throw new Error('PAYMENT_MISMATCH')
  if (p.status==='succeeded') return false
  if (provider.status==='canceled') {await db.query("UPDATE payments SET status='canceled' WHERE id=$1",[id]);return false}
  if (provider.status!=='succeeded') return false
  await db.query('UPDATE wallets SET balance=balance+$2 WHERE user_id=$1',[p.user_id,p.amount])
  await db.query(`INSERT INTO ledger(id,user_id,kind,amount,payment_id,operation_key) VALUES($1,$2,'topup',$3,$4,$5)`,[randomUUID(),p.user_id,p.amount,p.id,`topup:${provider.id}`])
  await db.query("UPDATE payments SET status='succeeded',test=true WHERE id=$1",[id]);return true
}
