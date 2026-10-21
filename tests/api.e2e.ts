import assert from 'node:assert/strict'
import {createHmac,randomUUID} from 'node:crypto'
import {createServer} from 'node:http'
import {readFile} from 'node:fs/promises'
import {spawn} from 'node:child_process'
import {mkdir} from 'node:fs/promises'
import {chromium} from 'playwright'
import pg from 'pg'
const schema=`qa_${randomUUID().replaceAll('-','')}`,base='http://127.0.0.1:3101',fixtureToken='fixture-bot-token'
const admin=new pg.Pool({connectionString:process.env.DATABASE_URL});await admin.query(`CREATE SCHEMA ${schema}`)
const db=new pg.Pool({connectionString:process.env.DATABASE_URL,options:`-c search_path=${schema}`})
const url=new URL(process.env.DATABASE_URL!);url.searchParams.set('options',`-c search_path=${schema}`)
const payments=new Map<string,any>()
let aiCalls=0
const fixture=createServer(async(req,res)=>{
  let text='';for await(const chunk of req)text+=chunk
  res.setHeader('Content-Type','application/json')
  if(req.url==='/ai'){
    aiCalls++;const body=JSON.parse(text);const data=JSON.parse(body.messages[1].content)
    res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({summary:'Это тестовый ответ локального провайдера для проверки обработки результата.',positions:data.cards.map((c:any)=>({cardId:c.cardId,text:'Проверка точного соответствия карты и позиции в сохранённом ответе.'})),synthesis:'Карты сохранены в исходном порядке, повторный запрос не создаёт новый результат.',advice:'Это интеграционный тест, а не реальное толкование.'})}}]}));return
  }
  if(req.method==='POST'&&req.url==='/payments'){
    const body=JSON.parse(text),key=String(req.headers['idempotence-key']);const old=[...payments.values()].find(x=>x.key===key)
    const p=old||{id:randomUUID(),key,status:'pending',test:true,amount:body.amount,metadata:body.metadata,confirmation:{confirmation_url:'https://yookassa.ru/test-fixture'}}
    payments.set(p.id,p);res.end(JSON.stringify(p));return
  }
  const id=req.url?.split('/').pop();res.end(JSON.stringify(payments.get(id||'')||{}))
})
await new Promise<void>(r=>fixture.listen(3102,'127.0.0.1',r))
const env={...process.env,NODE_ENV:'test',DATABASE_URL:url.toString(),BOT_TOKEN:fixtureToken,SESSION_SECRET:'fixture-session-secret-at-least-32-characters',APP_URL:base,PORT:'3101',HOST:'127.0.0.1',DEEPSEEK_API_KEY:'fixture',DEEPSEEK_MODEL:'fixture',TEST_DEEPSEEK_URL:'http://127.0.0.1:3102/ai',YOOKASSA_SHOP_ID:'fixture',YOOKASSA_SECRET_KEY:'test_fixture',PAYMENTS_ENABLED:'true',TEST_YOOKASSA_URL:'http://127.0.0.1:3102/'}
let server:ReturnType<typeof spawn>|undefined,worker:ReturnType<typeof spawn>|undefined
const wait=async(fn:()=>Promise<any>)=>{for(let i=0;i<60;i++){try{if(await fn())return}catch{}await new Promise(r=>setTimeout(r,500))}throw new Error('Timeout')}
function initData(id:number){const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'QA'})});const d=[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(fixtureToken).digest()).update(d).digest('hex'));return p.toString()}
const request=(path:string,cookie='',body?:unknown)=>fetch(base+path,{method:body?'POST':'GET',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},...(body?{body:JSON.stringify(body)}:{})})
try{
  await db.query(await readFile(new URL('../server/core/schema.sql',import.meta.url),'utf8'))
  server=spawn(process.execPath,['--import','./tests/provider-hook.mjs','.output/server/index.mjs'],{env,stdio:'ignore',windowsHide:true})
  await wait(async()=> (await fetch(base+'/api/health')).ok)
  const auth=await request('/api/auth','',{initData:initData(10001)});assert.equal(auth.status,200)
  const cookie=auth.headers.get('set-cookie')!.split(';')[0]!
  assert.equal((await request('/api/me')).status,401)
  assert.equal((await request('/api/auth','',{initData:initData(10001).replace('QA','FORGED')})).status,401)
  const input={key:randomUUID(),count:3,question:'Проверка полного серверного сценария'}
  assert.equal((await request('/api/readings',cookie,input)).status,409)
  const pBody={key:randomUUID(),amount:10000}
  const payment=await(await request('/api/payments',cookie,pBody)).json()
  assert.ok(payment.id)
  const repeated=await(await request('/api/payments',cookie,pBody)).json();assert.equal(payment.id,repeated.id);assert.equal(payments.size,1)
  const remote=[...payments.values()][0];remote.status='succeeded'
  // Forged webhook status is ignored; authoritative GET is used by implementation.
  await request('/api/webhooks/yookassa','',{object:{id:remote.id},event:'payment.succeeded'})
  await request('/api/webhooks/yookassa','',{object:{id:remote.id},event:'payment.succeeded'})
  assert.equal((await(await request('/api/me',cookie)).json()).balance,10000)
  const made=await(await request('/api/readings',cookie,input)).json();assert.ok(made.id)
  assert.equal((await(await request('/api/readings',cookie,input)).json()).id,made.id)
  worker=spawn(process.execPath,['--import','./tests/provider-hook.mjs','--import','tsx','scripts/worker.ts'],{env,stdio:'ignore',windowsHide:true})
  await wait(async()=> (await(await request(`/api/readings/${made.id}`,cookie)).json()).status==='completed')
  assert.equal(aiCalls,1)
  const me=await(await request('/api/me',cookie)).json();assert.equal(me.balance,0);assert.equal(me.reserved,0)
  const reading=await(await request(`/api/readings/${made.id}`,cookie)).json();assert.equal(reading.result.positions.length,3);assert.equal(new Set(reading.cards.map((c:any)=>c.id)).size,3)
  const a2=await request('/api/auth','',{initData:initData(10002)});const cookie2=a2.headers.get('set-cookie')!.split(';')[0]!
  assert.equal((await request(`/api/readings/${made.id}`,cookie2)).status,404)
  assert.equal((await request('/api/payments',cookie,{key:randomUUID(),amount:1})).status,400)
  const badOrigin=await fetch(base+'/api/readings',{method:'POST',headers:{Cookie:cookie,Origin:'https://evil.invalid','Content-Type':'application/json'},body:JSON.stringify(input)});assert.equal(badOrigin.status,403)
  assert.equal((await db.query("SELECT * FROM ledger WHERE kind='charge'")).rows.length,1)
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true})
  try {
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
    await page.route('https://telegram.org/js/telegram-web-app.js',route=>route.fulfill({contentType:'application/javascript',body:'/* Telegram SDK is emulated by this test. */'}))
    await page.addInitScript((data)=>{(window as any).Telegram={WebApp:{initData:data,ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},onEvent(){},offEvent(){},openLink(url:string){(window as any).paymentLink=url},BackButton:{show(){},hide(){},onClick(){},offClick(){}}}}},initData(10003))
    await page.goto(base,{waitUntil:'networkidle'})
    await page.locator('#question').fill('Как лучше подготовиться к новой работе?')
    await page.getByRole('button',{name:/Получить расклад/}).click()
    await page.getByRole('dialog').waitFor()
    await page.getByRole('button',{name:'100 ₽',exact:true}).click()
    await page.getByRole('button',{name:'Перейти к оплате 100 ₽',exact:true}).click()
    await page.getByRole('button',{name:'Проверить оплату',exact:true}).waitFor()
    const uiPayment=[...payments.values()].find(p=>p.id!==remote.id);assert.ok(uiPayment)
    uiPayment.status='succeeded'
    await page.getByRole('button',{name:'Проверить оплату',exact:true}).click()
    await page.getByText('Пополнение подтверждено',{exact:true}).waitFor()
    await page.getByRole('button',{name:'На главную',exact:true}).click()
    assert.equal(await page.locator('#question').inputValue(),'Как лучше подготовиться к новой работе?')
    await page.getByRole('button',{name:/Одна карта/}).click()
    await page.getByRole('button',{name:/Получить расклад/}).click()
    await page.getByRole('button',{name:'Подтвердить 50 ₽',exact:true}).click()
    await page.getByRole('button',{name:'Открыть все карты',exact:true}).click()
    await page.getByRole('button',{name:'Читать толкование',exact:true}).click({timeout:20000})
    await page.getByText('Индивидуальное толкование',{exact:true}).waitFor()
    await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/authenticated-result-390.png',fullPage:true})
    await page.getByRole('button',{name:'История',exact:true}).click()
    await page.getByRole('heading',{name:'Как лучше подготовиться к новой работе?'}).waitFor()
    assert.equal((await db.query('SELECT balance FROM wallets WHERE user_id=10003')).rows[0].balance,5000)
    assert.equal(aiCalls,2)
  } finally {await browser.close()}
  console.log('API E2E PASS: signed auth, no-auth/forged/cross-user rejection, topup, duplicate notifications, reserve, worker generation, single charge, persisted history, insufficient balance, CSRF. Providers are local fixtures, not live services.')
  console.log('Authenticated mobile UI PASS: insufficient funds -> YooKassa test fixture -> credited wallet -> preserved question -> paid reading -> result -> history. Telegram SDK is emulated, signature is checked by real backend.')
}finally{
  for(const p of [worker,server])if(p&&!p.killed){p.kill();await new Promise(r=>{p.once('exit',r);setTimeout(r,2000)})}
  await new Promise<void>(r=>fixture.close(()=>r()));await db.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end()
}
