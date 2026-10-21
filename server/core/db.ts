import pg from 'pg'
export interface DB { query(text: string, values?: any[]): Promise<{ rows: any[], rowCount?: number | null }> }
let pool: pg.Pool
export function database(): pg.Pool {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_NOT_CONFIGURED')
  return pool ||= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 })
}
export async function transaction<T>(fn: (db: DB) => Promise<T>): Promise<T> {
  const client = await database().connect()
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result }
  catch (e) { await client.query('ROLLBACK'); throw e }
  finally { client.release() }
}
