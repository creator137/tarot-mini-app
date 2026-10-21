import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
await mkdir('artifacts',{recursive:true})
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true})
const errors=[]
try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,colorScheme:'dark'})
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto(process.env.PREVIEW_URL||'http://localhost:3000',{waitUntil:'networkidle'})
  await page.getByText('Предпросмотр · без оплаты и генерации ИИ').waitFor()
  await page.screenshot({path:'artifacts/home-390.png',fullPage:true})
  await page.locator('#question').fill('Что поможет мне двигаться вперёд в работе?')
  await page.getByRole('button',{name:/Получить расклад/}).click()
  await page.getByRole('button',{name:'Посмотреть пример',exact:true}).click()
  await page.getByRole('button',{name:'Открыть все карты'}).waitFor()
  await page.screenshot({path:'artifacts/reveal-390.png',fullPage:true})
  await page.getByRole('button',{name:'Открыть карту 1',exact:true}).click()
  await page.getByRole('button',{name:'Открыть все карты'}).click()
  await page.getByRole('button',{name:'Читать толкование'}).click()
  await page.getByText('Пример толкования',{exact:true}).waitFor()
  await page.screenshot({path:'artifacts/result-390.png',fullPage:true})
  await page.getByRole('button',{name:'Увеличить: Шут',exact:true}).click()
  await page.getByRole('dialog').waitFor();await page.screenshot({path:'artifacts/card-390.png'});await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'История',exact:true}).click();await page.getByRole('heading',{name:'История раскладов'}).waitFor()
  await page.screenshot({path:'artifacts/history-390.png',fullPage:true})
  await page.getByRole('button',{name:'Баланс',exact:true}).click();await page.getByRole('button',{name:'Пополнить баланс',exact:true}).click();await page.getByRole('dialog').waitFor()
  await page.getByLabel('Другая сумма, ₽').waitFor();await page.waitForTimeout(700)
  await page.screenshot({path:'artifacts/topup-390.png'})
  await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'На главную',exact:true}).click()
  await page.getByRole('button',{name:/Одна карта/}).click()
  await page.getByRole('button',{name:/Получить расклад/}).click();await page.getByRole('button',{name:'Посмотреть пример',exact:true}).click()
  assert.equal(await page.locator('.tarot-card').count(),1)
  await page.getByRole('button',{name:'Открыть все карты'}).click();await page.getByRole('button',{name:'Читать толкование'}).click()
  await page.screenshot({path:'artifacts/single-390.png',fullPage:true})
  for(const width of [320,375,430,768]){
    await page.setViewportSize({width,height:844});await page.getByRole('button',{name:'На главную',exact:true}).click()
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Horizontal overflow at ${width}`)
    await page.screenshot({path:`artifacts/home-${width}.png`,fullPage:true})
  }
  assert.deepEqual(errors,[])
  console.log('Browser PASS: home, 1/3 cards, reveal, result, zoom, history, wallet/drawer, 320/375/390/430/768 widths, no runtime errors. Preview scenarios only.')
}finally{await browser.close()}
