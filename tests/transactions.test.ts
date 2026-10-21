import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { reserveReading,settleReading,failReading,creditPayment } from '../server/core/wallet'
const schema=await readFile(new URL('../server/core/schema.sql',import.meta.url),'utf8')
test('wallet: retries, failed generation, leases, duplicate provider notifications',async()=>{
  const db=new PGlite();await db.exec(schema)
  await db.query("INSERT INTO users(id) VALUES(123)");await db.query('INSERT INTO wallets(user_id,balance) VALUES(123,15000)')
  const input={userId:'123',key:randomUUID(),question:'Как поступить?',count:3 as const,cards:[{id:'major.fool'}]}
  const r=await db.transaction(tx=>reserveReading(tx,input))
  const repeat=await db.transaction(tx=>reserveReading(tx,input));assert.equal(r.id,repeat.id)
  await assert.rejects(()=>db.transaction(tx=>reserveReading(tx,{...input,count:1})),/IDEMPOTENCY_CONFLICT/)
  await assert.rejects(()=>db.transaction(tx=>reserveReading(tx,{...input,key:randomUUID()})),/INSUFFICIENT_FUNDS/)
  const lease=randomUUID();await db.query("UPDATE readings SET status='processing',lease_token=$2,attempts=1 WHERE id=$1",[r.id,lease])
  assert.equal(await db.transaction(tx=>settleReading(tx,r.id,randomUUID(),{},'test')),false)
  assert.equal(await db.transaction(tx=>settleReading(tx,r.id,lease,{summary:'saved'},'test')),true)
  assert.equal(await db.transaction(tx=>settleReading(tx,r.id,lease,{},'test')),false)
  assert.deepEqual((await db.query('SELECT balance,reserved FROM wallets')).rows[0],{balance:5000,reserved:0})
  const failed=await db.transaction(tx=>reserveReading(tx,{...input,key:randomUUID(),count:1}))
  const lease2=randomUUID();await db.query("UPDATE readings SET status='processing',lease_token=$2,attempts=3 WHERE id=$1",[failed.id,lease2])
  await db.transaction(tx=>failReading(tx,failed.id,lease2));await db.transaction(tx=>failReading(tx,failed.id,lease2))
  assert.deepEqual((await db.query('SELECT balance,reserved FROM wallets')).rows[0],{balance:5000,reserved:0})
  const payid=randomUUID();await db.query("INSERT INTO payments(id,user_id,request_key,amount,provider_id) VALUES($1,123,$2,10000,'provider-1')",[payid,randomUUID()])
  const provider={id:'provider-1',status:'succeeded',test:true,amount:{value:'100.00',currency:'RUB'},metadata:{payment_id:payid}}
  await assert.rejects(()=>db.transaction(tx=>creditPayment(tx,payid,{...provider,test:false})),/PAYMENT_MISMATCH/)
  await assert.rejects(()=>db.transaction(tx=>creditPayment(tx,payid,{...provider,amount:{value:'1000.00',currency:'RUB'}})),/PAYMENT_MISMATCH/)
  assert.equal(await db.transaction(tx=>creditPayment(tx,payid,provider)),true)
  assert.equal(await db.transaction(tx=>creditPayment(tx,payid,provider)),false)
  assert.deepEqual((await db.query('SELECT balance,reserved FROM wallets')).rows[0],{balance:15000,reserved:0})
  assert.equal((await db.query("SELECT * FROM ledger WHERE kind='charge'")).rows.length,1)
  assert.equal((await db.query("SELECT * FROM ledger WHERE kind='release'")).rows.length,1)
  assert.equal((await db.query("SELECT * FROM ledger WHERE kind='topup'")).rows.length,1)
  // A crash between wallet change and journal insertion must roll back the whole transaction.
  await assert.rejects(()=>db.transaction(async tx=>{await tx.query('UPDATE wallets SET balance=balance+100 WHERE user_id=123');throw new Error('crash')}),/crash/)
  assert.equal((await db.query<any>('SELECT balance FROM wallets')).rows[0].balance,15000)
  await db.close()
})
