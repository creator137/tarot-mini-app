<script setup lang="ts">
import { cards } from '#shared/data/cards'
type Draw={id:string;reversed:boolean;position:string}
type Reading={id:string;question:string;count:number;price:number;cards:Draw[];status:string;created_at:string;result?:{summary:string;positions:{cardId:string;text:string}[];synthesis:string;advice:string}}
const toast=useToast()
const tab=ref<'reading'|'history'|'wallet'>('reading'), screen=ref<'home'|'reveal'|'result'>('home')
const count=ref<1|3>(3),question=ref(''),busy=ref(false),demo=ref(false),ready=ref(false),authError=ref('')
const balance=ref(0),reserved=ref(0),name=ref(''),history=ref<Reading[]>([]),operations=ref<any[]>([])
const current=ref<Reading|null>(null),opened=ref<number[]>([]),zoom=ref<any>(null),topup=ref(false),help=ref(false),confirm=ref(false),amount=ref(300)
const requestKey=ref(''),paymentKey=ref(''),paymentId=ref(''),paymentStatus=ref(''),waiting=ref(false)
const connectionLost=ref(false)
let timer:ReturnType<typeof setInterval>|undefined
const price=computed(()=>count.value===1?50:100),available=computed(()=>balance.value-reserved.value)
const money=(c:number)=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(c/100)
const date=(s:string)=>new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(new Date(s))
const card=(id:string)=>cards.find(c=>c.id===id) || cards[0]!
const chosen=computed(()=>current.value?.cards.map(d=>({...card(d.id),...d})) || [])
const allOpen=computed(()=>!!current.value && opened.value.length===current.value.cards.length)
const suggestions=['Что сейчас важно в отношениях?','На что обратить внимание в работе?','Что поможет мне двигаться вперёд?']
const tg=()=> (window as any).Telegram?.WebApp
const notify=(e:any)=>{toast.add({title:e?.data?.statusMessage || e?.statusMessage || 'Не удалось выполнить действие',description:'Ваш вопрос сохранён. Попробуйте ещё раз.',color:'error'})}
function newReading(){screen.value='home';current.value=null;opened.value=[];tab.value='reading';requestKey.value='';if(import.meta.client)sessionStorage.removeItem('active-reading');window.scrollTo({top:0,behavior:'smooth'})}
async function refresh(){if(demo.value)return;const me=await $fetch<any>('/api/me');balance.value=me.balance;reserved.value=me.reserved;name.value=me.first_name}
async function loadHistory(){if(demo.value)return;try{history.value=await $fetch<Reading[]>('/api/readings')}catch(e){notify(e)}}
async function loadWallet(){if(demo.value)return;try{const d=await $fetch<any>('/api/wallet');balance.value=d.wallet.balance;reserved.value=d.wallet.reserved;operations.value=d.operations}catch(e){notify(e)}}
function ask(){if(!ready.value||authError.value)return;if(question.value.trim().length<5){toast.add({title:'Расскажите чуть подробнее',description:'Вопрос должен содержать от 5 до 600 символов.',color:'warning'});return}if(available.value<price.value*100){topup.value=true;return}confirm.value=true}
async function start(){
  confirm.value=false;busy.value=true
  try{
    const saved=JSON.parse(sessionStorage.getItem('pending-reading-request')||'null')
    requestKey.value ||= saved?.question===question.value.trim()&&saved?.count===count.value?saved.key:crypto.randomUUID()
    sessionStorage.setItem('pending-reading-request',JSON.stringify({key:requestKey.value,question:question.value.trim(),count:count.value}))
    if(demo.value){
      const sample=count.value===1?[cards[0]!]:[cards[0]!,cards[17]!,cards[1]!]
      current.value={id:crypto.randomUUID(),question:question.value.trim(),count:count.value,price:price.value*100,cards:sample.map((c,i)=>({id:c.id,reversed:false,position:count.value===1?'Главное для вас':['Ситуация','Что влияет','Совет'][i]!})),status:'completed',created_at:new Date().toISOString(),result:{summary:'Сейчас полезно дать себе пространство для нового взгляда. Не обязательно знать весь путь заранее — достаточно увидеть следующий шаг.',positions:sample.map(c=>({cardId:c.id,text:c.upright+' В контексте вашего вопроса это приглашение заметить собственные потребности и выбрать посильное действие.'})),synthesis:'Эти карты объединяет тема внутренней опоры. Сначала отделите то, что вы знаете, от того, что только предполагаете. Затем посмотрите, какое небольшое изменение находится в вашей власти.',advice:'Запишите один шаг, который вы можете сделать сегодня без спешки и давления на себя.'}}
      // Explicit preview only: no wallet mutations and no pretend provider requests.
      history.value.unshift(current.value)
    }else{
      const r=await $fetch<any>('/api/readings',{method:'POST',body:{key:requestKey.value,question:question.value.trim(),count:count.value}})
      sessionStorage.setItem('active-reading',r.id);current.value=await $fetch<Reading>(`/api/readings/${r.id}`);await refresh()
    }
    sessionStorage.removeItem('pending-reading-request');requestKey.value=''
    opened.value=[];screen.value='reveal';tab.value='reading';window.scrollTo({top:0,behavior:'smooth'})
  }catch(e:any){if(e?.data?.data?.code==='INSUFFICIENT_FUNDS'){await refresh();topup.value=true}else notify(e)}finally{busy.value=false}
}
function reveal(i:number){if(opened.value.includes(i)){zoom.value=chosen.value[i];return}opened.value.push(i);tg()?.HapticFeedback?.impactOccurred('light')}
async function openHistory(r:Reading){try{current.value=demo.value?r:await $fetch<Reading>(`/api/readings/${r.id}`);opened.value=current.value.cards.map((_,i)=>i);tab.value='reading';screen.value=current.value.status==='completed'?'result':'reveal';window.scrollTo(0,0)}catch(e){notify(e)}}
async function poll(){
  if(demo.value||!current.value||!['pending','processing'].includes(current.value.status))return
  const id=current.value.id
  try{const reading=await $fetch<Reading>(`/api/readings/${id}`);connectionLost.value=false;if(current.value?.id!==id)return;current.value=reading;if(['completed','failed'].includes(reading.status))await refresh()}
  catch{connectionLost.value=true}
}
async function pay(){
  if(demo.value){toast.add({title:'Это демонстрационный режим',description:'В нём пополнение и списания отключены.',color:'info'});return}
  busy.value=true
  try{
    const saved=JSON.parse(sessionStorage.getItem('pending-payment-request')||'null')
    paymentKey.value ||= saved?.amount===amount.value?saved.key:crypto.randomUUID()
    sessionStorage.setItem('pending-payment-request',JSON.stringify({key:paymentKey.value,amount:amount.value}))
    const p=await $fetch<any>('/api/payments',{method:'POST',body:{key:paymentKey.value,amount:amount.value*100}})
    paymentId.value=p.id;sessionStorage.setItem('pending-payment',p.id);paymentStatus.value='pending';topup.value=false;tab.value='wallet'
    if(tg()?.openLink)tg().openLink(p.url);else window.location.assign(p.url)
  }catch(e){notify(e)}finally{busy.value=false}
}
async function checkPayment(){if(!paymentId.value||waiting.value)return;waiting.value=true;try{const p=await $fetch<any>(`/api/payments/${paymentId.value}`);paymentStatus.value=p.status;if(['succeeded','canceled'].includes(p.status)){sessionStorage.removeItem('pending-payment');sessionStorage.removeItem('pending-payment-request');paymentKey.value='';await loadWallet();if(p.status==='succeeded')toast.add({title:'Баланс пополнен',description:'Можно вернуться к вашему вопросу.',color:'success'})}}catch(e){notify(e)}finally{waiting.value=false}}
watch(tab,t=>{if(t==='history')loadHistory();if(t==='wallet')loadWallet()})
watch([question,count],()=>{requestKey.value='';if(import.meta.client)sessionStorage.setItem('question-draft',JSON.stringify({question:question.value,count:count.value}))})
watch(amount,()=>paymentKey.value='')
watch([screen,tab],()=>{const back=tg()?.BackButton;if(screen.value!=='home'||tab.value!=='reading')back?.show();else back?.hide()})
function back(){if(zoom.value){zoom.value=null;return}if(topup.value){topup.value=false;return}if(tab.value!=='reading'){tab.value='reading';return}newReading()}
function viewport(){const t=tg();if(!t)return;document.documentElement.style.setProperty('--tg-height',`${t.viewportStableHeight||window.innerHeight}px`);document.documentElement.style.setProperty('--safe-bottom',`${Math.max(t.safeAreaInset?.bottom||0,t.contentSafeAreaInset?.bottom||0)}px`);document.documentElement.style.setProperty('--safe-top',`${Math.max(t.safeAreaInset?.top||0,t.contentSafeAreaInset?.top||0)}px`)}
onMounted(async()=>{
  try{const draft=JSON.parse(sessionStorage.getItem('question-draft')||'null');if(draft){question.value=String(draft.question||'').slice(0,600);count.value=draft.count===1?1:3}}catch{}
  const t=tg();t?.ready();t?.expand();t?.setHeaderColor?.('#0c0b10');t?.setBackgroundColor?.('#0c0b10');viewport();t?.onEvent('viewportChanged',viewport);t?.onEvent('safeAreaChanged',viewport);t?.onEvent('contentSafeAreaChanged',viewport);t?.BackButton?.onClick(back)
  if(t?.initData){try{await $fetch('/api/auth',{method:'POST',body:{initData:t.initData}});await refresh();const pending=sessionStorage.getItem('active-reading');if(pending){current.value=await $fetch<Reading>(`/api/readings/${pending}`);screen.value='reveal'}paymentId.value=new URLSearchParams(location.search).get('payment')||sessionStorage.getItem('pending-payment')||'';if(paymentId.value){tab.value='wallet';await checkPayment()}}catch(e:any){authError.value=e?.data?.statusMessage||'Не удалось подключить аккаунт. Откройте приложение заново.'}}
  else{demo.value=true;balance.value=30000}
  ready.value=true;timer=setInterval(poll,2500)
})
onUnmounted(()=>{clearInterval(timer);const t=tg();t?.offEvent('viewportChanged',viewport);t?.offEvent('safeAreaChanged',viewport);t?.offEvent('contentSafeAreaChanged',viewport);t?.BackButton?.offClick(back)})
</script>

<template>
  <UApp><div class="app-shell">
    <header class="app-header"><button class="brand" aria-label="На главную" @click="newReading"><span class="brand-star">✦</span><span>расклад<span class="brand-sub">ОНЛАЙН</span></span></button><UButton class="balance-pill" color="neutral" variant="soft" icon="i-lucide-wallet" @click="tab='wallet'">{{money(available)}}<UIcon name="i-lucide-plus" class="balance-plus"/></UButton></header>
    <div v-if="demo" class="demo-strip"><span class="status-dot"/>Предпросмотр · без оплаты и генерации ИИ</div>
    <main>
      <UAlert v-if="authError" :description="authError" title="Не удалось войти" icon="i-lucide-circle-alert" color="error" variant="soft" class="mb-6"/>
      <UAlert v-if="connectionLost" title="Связь временно потеряна" description="Расклад сохранён. Мы автоматически проверим готовность, когда соединение восстановится." icon="i-lucide-wifi-off" color="warning" variant="soft" class="mt-4"/>
      <div v-if="!ready" class="loading-shell"><USkeleton class="h-8 w-48"/><USkeleton class="h-80 w-full mt-6"/><USkeleton class="h-14 w-full mt-6"/></div>
      <template v-else-if="tab==='reading'">
        <section v-if="screen==='home'" class="home-screen">
          <div class="hero-copy"><div class="eyebrow"><span/> ПРОСТРАНСТВО ДЛЯ ВАШИХ ОТВЕТОВ</div><h1>Иногда достаточно<br><span>одного знака.</span></h1><p>Задайте вопрос. Откройте карты.<br>Посмотрите на свою историю по-новому.</p></div>
          <div class="hero-scene" aria-hidden="true"><div class="orbit orbit-one"/><div class="orbit orbit-two"/><span class="scene-star star-one">✧</span><span class="scene-star star-two">✦</span><span class="scene-star star-three">·</span><img class="hero-card hero-left" :src="cards[17]?.image" alt=""/><img class="hero-card hero-right" :src="cards[1]?.image" alt=""/><img class="hero-card hero-center" :src="cards[0]?.image" alt=""/><div class="scene-caption">78 КАРТ <span>✦</span> ВАША УНИКАЛЬНАЯ ИСТОРИЯ</div></div>
          <div class="section-label"><h2>Выберите свой расклад</h2><span>01 / 02</span></div>
          <div class="spread-options"><button :class="['spread-option',{selected:count===1}]" @click="count=1"><span class="spread-top"><span class="mini-cards one"><i/></span><span class="radio-dot"/></span><strong>Одна карта</strong><span class="spread-description">Фокус на главном</span><span class="spread-price">50 <small>₽</small></span></button><button :class="['spread-option',{selected:count===3}]" @click="count=3"><span class="spread-top"><span class="mini-cards three"><i/><i/><i/></span><span class="radio-dot"/></span><strong>Три карты</strong><span class="spread-description">Взгляд глубже</span><span class="spread-price">100 <small>₽</small></span><span class="recommended">БОЛЬШЕ ЯСНОСТИ</span></button></div>
          <p class="spread-note"><UIcon name="i-lucide-sparkles"/>{{count===1?'Одна карта — главный акцент и совет для вас.':'Ситуация · Что влияет · Совет'}}</p>
          <div class="question-section"><div class="section-label"><label for="question">Что вас волнует?</label><span>02 / 02</span></div><div class="question-wrap"><UTextarea id="question" v-model="question" :rows="4" :maxlength="600" autoresize placeholder="Например, что поможет мне найти гармонию в отношениях?" variant="none" class="w-full" :ui="{base:'question-input'}"/><span class="char-count">{{question.length}} / 600</span></div><div class="suggestions"><button v-for="s in suggestions" :key="s" @click="question=s">{{s}}<UIcon name="i-lucide-arrow-up-left"/></button></div></div>
          <UButton block size="xl" class="primary-action" :loading="busy" :disabled="!!authError" trailing-icon="i-lucide-arrow-right" @click="ask">Получить расклад <span class="action-price">{{price}} ₽</span></UButton>
          <p class="trust-note"><UIcon name="i-lucide-lock-keyhole"/>Ваш вопрос виден только вам</p>
          <div class="gentle-note"><span>✧</span><p>Карты не решают за вас.<br>Они помогают услышать себя.</p></div>
        </section>
        <section v-else-if="current" class="reading-screen">
          <button class="back-link" @click="newReading"><UIcon name="i-lucide-arrow-left"/>К новому вопросу</button>
          <div class="eyebrow centered">ВАШ ЛИЧНЫЙ РАСКЛАД</div><h1 class="reading-title">{{screen==='reveal'?'Ответ уже рядом.':'Ваша история в картах'}}</h1>
          <p v-if="screen==='reveal'" class="reading-subtitle">{{allOpen?'Все карты открыты. Прислушайтесь к себе.':'Сделайте спокойный вдох и откройте карты.'}}</p>
          <div class="reading-stage" :class="{'single-card':current.count===1}"><div class="stage-halo"/><div v-for="(c,i) in chosen" :key="c.id" class="draw-slot" :style="{'--card-delay':`${i*140}ms`}"><TarotCard :image="c.image" :name="c.name" :revealed="opened.includes(i)" :reversed="c.reversed" :index="i" interactive @open="reveal(i)"/><div class="draw-caption"><span>{{c.position}}</span><strong>{{opened.includes(i)?c.name:'Ваша карта'}}</strong><small v-if="opened.includes(i)&&c.reversed">Перевёрнутая</small></div></div></div>
          <div class="question-bubble"><span>ВАШ ВОПРОС</span><p>{{current.question}}</p></div>
          <template v-if="screen==='reveal'">
            <UButton v-if="!allOpen" block size="xl" variant="soft" class="primary-action" icon="i-lucide-sparkles" @click="opened=chosen.map((_,i)=>i)">Открыть все карты</UButton>
            <UButton v-else-if="current.status==='completed'" block size="xl" class="primary-action" trailing-icon="i-lucide-arrow-down" @click="screen='result'">Читать толкование</UButton>
            <div v-else-if="current.status==='failed'" class="status-panel"><UIcon name="i-lucide-cloud-off"/><h2>Не удалось подготовить ответ</h2><p>Резерв освобождён. Деньги за этот расклад не списаны.</p><UButton @click="newReading">Вернуться к вопросу</UButton></div>
            <div v-else class="status-panel"><span class="thinking-stars">✦</span><h2>Собираем вашу историю</h2><p>ИИ связывает значения карт с вашим вопросом. Можно закрыть приложение — результат останется в истории.</p><USkeleton class="h-2 w-3/4 mx-auto mt-5"/></div>
          </template>
          <article v-else-if="current.result" class="interpretation"><div class="answer-heading"><span class="answer-avatar">✦</span><div><strong>{{demo?'Пример толкования':'Индивидуальное толкование'}}</strong><span>{{demo?'Демонстрационный текст, не ответ ИИ':'Подготовлено с помощью ИИ'}}</span></div><UIcon name="i-lucide-sparkles"/></div><div class="summary-block"><span class="eyebrow">ГЛАВНОЕ ДЛЯ ВАС</span><p>{{current.result.summary}}</p></div><section v-for="(p,i) in current.result.positions" :key="p.cardId" class="position-answer"><div class="position-heading"><span>{{i+1}}</span><div><small>{{current.cards[i]?.position}}</small><h2>{{card(p.cardId).name}}</h2></div><UIcon name="i-lucide-star"/></div><p>{{p.text}}</p></section><section class="synthesis"><h2>Как складывается картина</h2><p>{{current.result.synthesis}}</p></section><section class="advice"><UIcon name="i-lucide-sprout"/><div><h2>Ваш маленький шаг</h2><p>{{current.result.advice}}</p></div></section><p class="saved-note"><UIcon name="i-lucide-bookmark-check"/>{{demo?'Пример доступен в истории до обновления страницы':'Расклад сохранён в вашей истории'}}</p><UButton block size="xl" variant="soft" class="primary-action" trailing-icon="i-lucide-arrow-right" @click="newReading">Задать новый вопрос</UButton><p class="disclaimer">Толкование — повод для размышления, а не предсказание или профессиональная рекомендация.</p></article>
        </section>
      </template>
      <section v-else-if="tab==='history'" class="history-screen"><div class="eyebrow">ВАША КОЛЛЕКЦИЯ СМЫСЛОВ</div><h1>История раскладов</h1><p class="page-intro">К важным ответам можно вернуться.</p><div v-if="!history.length" class="empty-state"><UIcon name="i-lucide-book-open"/><h2>Здесь начинается ваша история</h2><p>После первого расклада здесь появятся ваши карты, вопросы и толкования.</p><UButton size="lg" @click="newReading">Сделать расклад</UButton></div><button v-for="r in history" :key="r.id" class="history-item" @click="openHistory(r)"><div class="history-images"><img v-for="c in r.cards" :key="c.id" :src="card(c.id).image" :alt="card(c.id).name"/></div><div><span class="history-date">{{date(r.created_at)}}</span><h2>{{r.question}}</h2><span class="history-meta">{{r.count===1?'Одна карта':'Три карты'}} · {{r.status==='completed'?'Готово':r.status==='failed'?'Резерв возвращён':'Готовим ответ'}}</span></div><UIcon name="i-lucide-chevron-right"/></button></section>
      <section v-else class="wallet-screen"><div class="eyebrow">ВСЁ ПОД КОНТРОЛЕМ</div><h1>Ваш баланс</h1><div class="wallet-card"><span>Доступно для раскладов</span><strong>{{money(available)}}</strong><p v-if="reserved">В резерве: {{money(reserved)}}</p><p v-else>{{demo?'Демонстрационный баланс':'Одна карта — 50 ₽ · Три карты — 100 ₽'}}</p><UButton size="lg" block icon="i-lucide-plus" @click="topup=true">Пополнить баланс</UButton><span class="wallet-star">✦</span></div><UAlert v-if="paymentId" :title="paymentStatus==='succeeded'?'Пополнение подтверждено':paymentStatus==='canceled'?'Платёж отменён':'Проверяем оплату'" :description="paymentStatus==='succeeded'?'Средства доступны на балансе.':paymentStatus==='canceled'?'Средства не зачислены. Вы можете создать новый платёж.':'После оплаты нажмите «Проверить». Возврат из банка сам по себе не подтверждает платёж.'" color="neutral" variant="soft" class="mb-4"/><UButton v-if="paymentId&&paymentStatus==='pending'" :loading="waiting" @click="checkPayment">Проверить оплату</UButton><div class="section-label mt-8"><h2>История операций</h2><UIcon name="i-lucide-clock-3"/></div><div v-if="!operations.length" class="empty-transactions"><UIcon name="i-lucide-receipt-text"/><p>Пока нет операций</p><span>Пополнения и списания появятся здесь.</span></div><div v-for="op in operations" :key="op.id" class="operation"><span class="operation-icon"><UIcon :name="op.kind==='topup'?'i-lucide-arrow-down-left':'i-lucide-sparkles'"/></span><div><strong>{{({topup:'Пополнение',hold:'Резерв на расклад',release:'Освобождение резерва',charge:'Оплата расклада',refund:'Возврат'} as any)[op.kind]}}</strong><small>{{date(op.created_at)}}</small></div><b :class="{positive:op.kind==='topup'}">{{op.kind==='topup'?'+':op.kind==='charge'?'−':''}}{{money(op.amount)}}</b></div><p class="disclaimer">Пополнение через ЮKassa. В этой версии доступны только тестовые платежи.</p></section>
      <footer class="page-footer"><button @click="help=true">О сервисе и помощь</button><span>С вниманием к вам <span class="violet">✦</span></span></footer>
    </main>
    <nav class="bottom-nav" aria-label="Основная навигация"><button v-for="item in [{id:'reading',label:'Расклад',icon:'i-lucide-sparkles'},{id:'history',label:'История',icon:'i-lucide-book-open'},{id:'wallet',label:'Баланс',icon:'i-lucide-wallet'}]" :key="item.id" :class="{active:tab===item.id}" :aria-current="tab===item.id?'page':undefined" @click="tab=item.id as any"><UIcon :name="item.icon"/><span>{{item.label}}</span><i v-if="tab===item.id"/></button></nav>
    <UDrawer v-model:open="topup" title="Пополнить баланс" description="Выберите сумму для ваших будущих раскладов." :ui="{content:'app-drawer',container:'max-w-lg mx-auto'}"><template #body><UAlert v-if="demo" title="Демонстрационный режим" description="Реальные деньги не используются. Откройте приложение в Telegram для входа." color="neutral" variant="soft" class="mb-5"/><div class="amount-options"><UButton v-for="v in [100,300,500,1000]" :key="v" :variant="amount===v?'solid':'soft'" size="lg" @click="amount=v">{{v}} ₽</UButton></div><label class="field-label" for="topup-amount">Другая сумма, ₽</label><UInput id="topup-amount" v-model.number="amount" type="number" :min="50" :max="10000" size="xl" class="w-full"/><p class="disclaimer">Тестовая оплата через ЮKassa. Средства появляются после подтверждения платёжной системой.</p></template><template #footer><UButton block size="xl" :loading="busy" :disabled="!Number.isInteger(amount)||amount<50||amount>10000" @click="pay">{{demo?'Пополнение недоступно в демо':`Перейти к оплате ${amount} ₽`}}</UButton></template></UDrawer>
    <UModal v-model:open="confirm" title="Всё готово к раскладу" :description="`${count===1?'Одна карта':'Три карты'} · ${price} ₽`"><template #body><p class="confirm-question">{{question}}</p><p class="disclaimer">Сумма резервируется на время подготовки. Если ответ не получится, резерв будет освобождён.{{demo?' Сейчас это бесплатный демонстрационный просмотр.':''}}</p></template><template #footer><UButton variant="ghost" color="neutral" @click="confirm=false">Вернуться</UButton><UButton :loading="busy" @click="start">{{demo?'Посмотреть пример':`Подтвердить ${price} ₽`}}</UButton></template></UModal>
    <UModal :open="!!zoom" :title="zoom?.name||'Карта'" :description="zoom?.reversed?'Перевёрнутое положение':'Прямое положение'" @update:open="v=>{if(!v)zoom=null}"><template #body><img v-if="zoom" :src="zoom.image" :alt="zoom.name" class="zoom-card" :class="{'upside-down':zoom.reversed}"/><p v-if="zoom" class="zoom-meaning">{{zoom.reversed?zoom.reversedMeaning||card(zoom.id).reversed:zoom.upright}}</p></template></UModal>
    <UDrawer v-model:open="help" title="О сервисе" description="Расклад онлайн · Карты таро"><template #body><div class="help-content"><h2>Взгляд на вашу ситуацию</h2><p>Вы выбираете одну или три карты и задаёте вопрос. Индивидуальное толкование готовит ИИ. Оно помогает размышлять, но не гарантирует событий и не заменяет профессиональную помощь.</p><h2>Оплата и возврат</h2><p>Одна карта — 50 ₽, три — 100 ₽. На время генерации сумма резервируется. При окончательной ошибке резерв автоматически освобождается. История доступна без повторной оплаты.</p><h2>Приватность</h2><p>Не указывайте в вопросе ФИО, телефоны, адреса и другие личные данные. Текст вопроса передаётся DeepSeek для подготовки ответа.</p><UAlert title="Подготовка к запуску" description="Реквизиты продавца, контакты поддержки и окончательная политика обработки данных должны быть добавлены владельцем сервиса до публичного запуска. Реальные платежи отключены." color="warning" variant="soft"/></div></template></UDrawer>
  </div></UApp>
</template>
