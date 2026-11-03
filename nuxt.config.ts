// DealSourcing (NOVALE) — configuração do Nuxt
// SPA estática (publicação no GitHub Pages). Rotas com "#" para funcionar
// em qualquer subpasta sem configurações extras de servidor.
const baseURL = process.env.NUXT_APP_BASE_URL || '/'

// Projeto Supabase do DealSourcing (valores públicos — podem ficar no código).
// A chave anon/publishable é pública por definição; segredos ficam só no Supabase.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nenexsfeqguwprpwvsfn.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_d3oDw2c6aKDpp5cZPdor_w_pDEoZbaX'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  ssr: false,
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  router: { options: { hashMode: true } },
  app: {
    baseURL,
    head: {
      htmlAttrs: { lang: 'pt-BR' },
      title: 'DealSourcing · NOVALE',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0D2B5E' },
        { name: 'description', content: 'DealSourcing — plataforma NOVALE de prospecção, avaliação e aquisição de provedores de internet.' },
        { name: 'application-name', content: 'DealSourcing' },
        { name: 'apple-mobile-web-app-title', content: 'DealSourcing' },
        { name: 'robots', content: 'noindex, nofollow' },
      ],
      link: [
        { rel: 'icon', href: `${baseURL}favicon.ico`, sizes: 'any' },
        { rel: 'icon', type: 'image/png', href: `${baseURL}brand/favicon.png` },
        { rel: 'apple-touch-icon', href: `${baseURL}apple-touch-icon.png` },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@600;700;800&display=swap' },
      ],
    },
  },
  runtimeConfig: {
    public: {
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY,
    },
  },
  typescript: { strict: true },
})
