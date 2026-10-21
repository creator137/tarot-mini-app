import { randomUUID } from 'node:crypto'
import { database,transaction } from '../server/core/db'
import { failReading,settleReading } from '../server/core/wallet'
import { interpret } from '../server/core/ai'
import { yookassa } from '../server/core/yookassa'
import { creditPayment } from '../server/core/wallet'
let stopping=false
let lastReconciliation=0
process.on('SIGINT',()=>{stopping=true});process.on('SIGTERM',()=>{stopping=true})
console.log('Reading worker started. Questions and provider responses are not logged.')
while(!stopping){
  try {
    if(process.env.PAYMENTS_ENABLED==='true' && Date.now()-lastReconciliation>30000){
      lastReconciliation=Date.now()
      const {rows}=await database().query("SELECT id,provider_id FROM payments WHERE status='pending' AND provider_id IS NOT NULL ORDER BY created_at LIMIT 20")
      for(const p of rows){try{const remote=await yookassa(`payments/${p.provider_id}`);await transaction(db=>creditPayment(db,p.id,remote))}catch{console.warn('Payment reconciliation deferred.')}}
    }
    // Expired leases are failed/retried through the same guarded state transition.
    await transaction(async db=>{
      const {rows}=await db.query("SELECT id,lease_token FROM readings WHERE status='processing' AND lease_until<now() FOR UPDATE SKIP LOCKED LIMIT 10")
      for(const r of rows)await failReading(db,r.id,r.lease_token)
    })
    const lease=randomUUID()
    const job=await transaction(async db=>{
      const {rows:[r]}=await db.query("SELECT * FROM readings WHERE status='pending' AND next_attempt_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1")
      if(!r)return null
      await db.query("UPDATE readings SET status='processing',attempts=attempts+1,lease_token=$2,lease_until=now()+interval '2 minutes' WHERE id=$1",[r.id,lease])
      return r
    })
    if(job){try{const {result,model}=await interpret(job);await transaction(db=>settleReading(db,job.id,lease,result,model))}catch{await transaction(db=>failReading(db,job.id,lease));console.warn('Generation attempt failed; retry/release recorded.')}}
    else await new Promise(r=>setTimeout(r,1500))
  }catch{console.error('Worker temporarily unavailable. Check database configuration.');await new Promise(r=>setTimeout(r,5000))}
}
await database().end()
