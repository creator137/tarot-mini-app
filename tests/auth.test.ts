import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { verifyInitData,signSession,verifySession } from '../server/core/auth'
import { paymentConfig } from '../server/core/yookassa'
test('Telegram: valid signature, forged user, expiry, duplicate query parameters',()=>{
  const now=Date.now(),token='test-fixture-token'
  const p=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id:123,first_name:'Тест'})})
  const data=[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n')
  p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(token).digest()).update(data).digest('hex'))
  assert.equal(verifyInitData(p.toString(),token,now).id,'123')
  assert.throws(()=>verifyInitData(p.toString(),token,now+301000),/EXPIRED_AUTH/)
  assert.throws(()=>verifyInitData(p.toString()+'&user={}',token,now),/INVALID_AUTH/)
  p.set('user','{"id":999}');assert.throws(()=>verifyInitData(p.toString(),token,now),/INVALID_AUTH/)
})
test('signed sessions cannot be forged or used after expiry',()=>{
  process.env.SESSION_SECRET='a-test-secret-that-is-at-least-32-characters'
  const token=signSession('123',1000)
  assert.equal(verifySession(token,2000),'123');assert.throws(()=>verifySession(token+'x',2000));assert.throws(()=>verifySession(token,86401001))
})
test('payment integration refuses live credentials even when enabled',()=>{
  process.env.PAYMENTS_ENABLED='true';process.env.YOOKASSA_SHOP_ID='fixture';process.env.YOOKASSA_SECRET_KEY='live_fake'
  assert.throws(()=>paymentConfig(),/LIVE_PAYMENTS_FORBIDDEN/)
  process.env.PAYMENTS_ENABLED='false';assert.throws(()=>paymentConfig(),/PAYMENTS_DISABLED/)
})
