// Loaded only by tests/api.e2e.ts through node --import; never bundled into the app.
if(process.env.NODE_ENV!=='test')throw new Error('Provider fixtures are test-only')
const original=globalThis.fetch
globalThis.fetch=(input,options)=>{
 const url=String(input)
 if(url==='https://api.deepseek.com/chat/completions')return original('http://127.0.0.1:3102/ai',options)
 if(url.startsWith('https://api.yookassa.ru/v3/'))return original('http://127.0.0.1:3102/'+url.slice('https://api.yookassa.ru/v3/'.length),options)
 if(url.startsWith('https://'))throw new Error('External HTTPS blocked in integration fixture')
 return original(input,options)
}
