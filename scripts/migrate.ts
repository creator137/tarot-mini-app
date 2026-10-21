import { readFile } from 'node:fs/promises'
import { database } from '../server/core/db'
try {await database().query(await readFile(new URL('../server/core/schema.sql',import.meta.url),'utf8'));console.log('Database schema is ready.')}catch{console.error('Migration failed. Check DATABASE_URL and database availability.');process.exitCode=1}finally{if(process.env.DATABASE_URL)await database().end()}
