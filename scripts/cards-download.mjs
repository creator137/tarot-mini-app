import { mkdirSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

// User authorized downloading and using these images on 2026-10-21.
// Provenance is recorded in docs/cards-provenance.md.
mkdirSync('public/cards', { recursive: true })
for (let i = 0; i <= 78; i++) {
  const path = `public/cards/${i}.jpg`
  if (existsSync(path)) continue
  const result = spawnSync('curl', ['--fail','--location','--silent','--show-error','--retry','3','--retry-delay','2','--connect-timeout','15','-A','Mozilla/5.0','-e','https://www.rozamira-tarot.ru/galeria/albom-zodiac-tarot-cecilia-lattari-zodiakalnoe-taro.html',`https://www.rozamira-tarot.ru/google/taro/zodiac-tarot-cecilia-lattari/x1701782587-${i}.jpg`,'--output',path], {stdio:'inherit'})
  if (result.status !== 0) throw new Error(`Download failed: ${i}`)
}
console.log('78 cards and one back downloaded')
