export default defineNuxtConfig({
  compatibilityDate: '2026-10-21',
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  debug: false,
  buildDir: '.nuxt',
  colorMode: { preference: 'dark', fallback: 'dark' },
  app: { head: { title: 'Расклад онлайн | Карты таро', htmlAttrs: { lang: 'ru' }, meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }], script: [{ src: 'https://telegram.org/js/telegram-web-app.js', defer: true }] } },
  typescript: { strict: true }
})
