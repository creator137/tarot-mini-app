export function paymentConfig() {
  if(process.env.PAYMENTS_ENABLED!=='true')throw new Error('PAYMENTS_DISABLED')
  const shop=process.env.YOOKASSA_SHOP_ID,key=process.env.YOOKASSA_SECRET_KEY
  if(!shop||!key)throw new Error('PAYMENTS_NOT_CONFIGURED')
  if(!key.startsWith('test_'))throw new Error('LIVE_PAYMENTS_FORBIDDEN')
  return Buffer.from(`${shop}:${key}`).toString('base64')
}
export async function yookassa(path:string,body?:unknown,key?:string) {
  const base='https://api.yookassa.ru/v3/'
  const res=await fetch(`${base}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Basic ${paymentConfig()}`,'Content-Type':'application/json',...(key?{'Idempotence-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)})
  if(!res.ok)throw new Error('PAYMENT_PROVIDER_ERROR')
  const data=await res.json()
  if(data.test!==true)throw new Error('LIVE_PAYMENTS_FORBIDDEN')
  return data
}
