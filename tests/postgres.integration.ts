import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import pg from 'pg'
import {reserveReading,settleReading} from '../server/core/wallet'
const schema=`qa_${randomUUID().replaceAll('-','')}`
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required')
const admin=new pg.Pool({connectionString:process.env.DATABASE_URL})
await admin.query(`CREATE SCHEMA ${schema}`)
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,options:`-c search_path=${schema}`,max:12})
const tx=async(fn:any)=>{const c=await pool.connect();try{await c.query('BEGIN');const r=await fn(c);await c.query('COMMIT');return r}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}}
try{
  await pool.query(await readFile(new URL('../server/core/schema.sql',import.meta.url),'utf8'))
  await pool.query('INSERT INTO users(id) VALUES(1)');await pool.query('INSERT INTO wallets(user_id,balance) VALUES(1,10000)')
  const input={userId:'1',key:randomUUID(),question:'Проверка одновременных запросов',count:3 as const,cards:[{id:'major.fool'}]}
  const copies=await Promise.all(Array.from({length:12},()=>tx((db:any)=>reserveReading(db,input))))
  assert.equal(new Set(copies.map(r=>r.id)).size,1)
  assert.deepEqual((await pool.query('SELECT balance,reserved FROM wallets')).rows[0],{balance:10000,reserved:10000})
  const id=copies[0].id,lease=randomUUID();await pool.query("UPDATE readings SET status='processing',lease_token=$2 WHERE id=$1",[id,lease])
  const results=await Promise.all(Array.from({length:8},()=>tx((db:any)=>settleReading(db,id,lease,{summary:'test'},'test'))))
  assert.equal(results.filter(Boolean).length,1);assert.deepEqual((await pool.query('SELECT balance,reserved FROM wallets')).rows[0],{balance:0,reserved:0})
  await pool.query('UPDATE wallets SET balance=10000 WHERE user_id=1')
  const competing=await Promise.allSettled(Array.from({length:8},()=>tx((db:any)=>reserveReading(db,{...input,key:randomUUID()}))))
  assert.equal(competing.filter(x=>x.status==='fulfilled').length,1)
  assert.equal(competing.filter(x=>x.status==='rejected').length,7)
  console.log('PostgreSQL concurrency PASS: 12 duplicate purchases -> 1 reserve; 8 settlements -> 1 charge; 8 competing purchases -> 1 success.')
}finally{await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end()}
