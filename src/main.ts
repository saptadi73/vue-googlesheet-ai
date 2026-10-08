import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@fontsource-variable/inter'
import './assets/main.css'

import App from './App.vue'
import router from './router'
import { restoreSession } from './lib/etl'

const app = createApp(App)

async function start() {
  try {
    await restoreSession()
  } catch (error) {
    console.error('Gagal memulihkan sesi pengguna:', error)
  }

  app.use(createPinia())
  app.use(router)
  app.mount('#app')
}

void start()
