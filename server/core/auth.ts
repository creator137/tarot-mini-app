import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto'
const equal = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
export function verifyInitData(raw: string, token: string, now = Date.now()) {
  const params = new URLSearchParams(raw)
  if ([...params.keys()].length !== new Set(params.keys()).size) throw new Error('INVALID_AUTH')
  const hash = params.get('hash'); params.delete('hash')
  const authDate = Number(params.get('auth_date'))
  if (!hash || !authDate || now / 1000 - authDate > 300 || authDate > now / 1000 + 30) throw new Error('EXPIRED_AUTH')
  const data = [...params.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(token).digest()
  if (!equal(hash, createHmac('sha256',secret).update(data).digest('hex'))) throw new Error('INVALID_AUTH')
  const user = JSON.parse(params.get('user') || '{}')
  if (!Number.isSafeInteger(user.id) || user.id <= 0) throw new Error('INVALID_AUTH')
  return { id: String(user.id), first_name: String(user.first_name || '').slice(0,100) }
}
function secret() {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) throw new Error('SESSION_NOT_CONFIGURED')
  return s
}
export function signSession(id: string, now=Date.now()) {
  const payload = Buffer.from(JSON.stringify({ id, exp: now+24*60*60*1000, nonce: randomUUID() })).toString('base64url')
  return `${payload}.${createHmac('sha256',secret()).update(payload).digest('hex')}`
}
export function verifySession(token: string, now=Date.now()) {
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra || !equal(signature,createHmac('sha256',secret()).update(payload).digest('hex'))) throw new Error('INVALID_SESSION')
  const parsed = JSON.parse(Buffer.from(payload,'base64url').toString())
  if (!/^\d+$/.test(parsed.id) || parsed.exp <= now) throw new Error('INVALID_SESSION')
  return parsed.id as string
}
