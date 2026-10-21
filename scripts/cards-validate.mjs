import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

const source = readFileSync('shared/data/cards.ts','utf8')
const cards = JSON.parse(source.match(/export const cards: readonly TarotCard\[\] = ([\s\S]*?)\nexport const cardBack/)[1])
assert.equal(cards.length,78)
assert.equal(new Set(cards.map(c=>c.id)).size,78)
assert.equal(new Set(cards.map(c=>c.image)).size,78)
assert.equal(cards.filter(c=>c.arcana==='major').length,22)
for (const suit of ['wands','cups','swords','pentacles']) assert.equal(cards.filter(c=>c.suit===suit).length,14)
assert.equal(cards.find(c=>c.id==='major.fool').name,'Шут')
const hashes = new Set()
function dimensions(bytes) {
  assert.equal(bytes.readUInt16BE(0),0xffd8,'JPEG header')
  let offset=2
  while(offset<bytes.length) {
    assert.equal(bytes[offset],0xff)
    const marker=bytes[offset+1]
    const size=bytes.readUInt16BE(offset+2)
    if ([0xc0,0xc1,0xc2].includes(marker)) return {width:bytes.readUInt16BE(offset+7),height:bytes.readUInt16BE(offset+5)}
    offset+=2+size
  }
  throw new Error('No JPEG dimensions')
}
const manifest = [...cards,{id:'back',image:'/cards/78.jpg'}].map(card=> {
  const bytes=readFileSync(`public${card.image}`)
  const sha256=createHash('sha256').update(bytes).digest('hex')
  assert.ok(!hashes.has(sha256),`Duplicate image ${card.id}`)
  hashes.add(sha256)
  const size=dimensions(bytes)
  assert.ok(size.width>=400 && size.height>=700)
  if(card.id!=='back') assert.ok(card.upright.length>20 && card.reversed.length>20)
  return {id:card.id,name:card.name,image:card.image,source:`https://www.rozamira-tarot.ru/google/taro/zodiac-tarot-cecilia-lattari/x1701782587-${card.image.split('/').pop()}`,bytes:bytes.length,...size,sha256}
})
writeFileSync('docs/cards-manifest.json',JSON.stringify(manifest,null,2)+'\n')
console.log('PASS: 78 unique card IDs, 22+4x14, Russian Fool, 79 unique JPEGs, dimensions and meanings; manifest updated.')
