import {test} from 'node:test'
import assert from 'node:assert/strict'
import {cards} from '../shared/data/cards'
import {existsSync} from 'node:fs'
test('catalog is complete, unique, translated and has all image assets',()=>{
  assert.equal(cards.length,78);assert.equal(new Set(cards.map(c=>c.id)).size,78)
  assert.equal(cards.filter(c=>c.arcana==='major').length,22)
  assert.equal(cards.find(c=>c.id==='major.fool')?.name,'Шут')
  for(const c of cards){assert.ok(existsSync(`public${c.image}`));assert.ok(c.upright.length>20);assert.ok(c.reversed.length>20);assert.ok(/[А-Яа-я]/.test(c.name))}
})
