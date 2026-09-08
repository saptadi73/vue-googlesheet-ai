<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'
import { Activity, ArrowRight, Database, RefreshCw, Sheet, Sparkles } from '@lucide/vue'
import { checkBackendHealth, getBackendHealth, getApiErrorMessage } from '@/lib/api'

const ActivityChart = defineAsyncComponent(() => import('@/components/charts/ActivityChart.vue'))
const checking = ref(false)
const connection = ref<'idle' | 'success' | 'error'>('idle')
const message = ref('Koneksi backend belum diperiksa.')
const healthDetails = ref<Record<string, unknown> | null>(null)
async function checkReadiness() {
  checking.value = true
  healthDetails.value = null
  try {
    healthDetails.value = await getBackendHealth('ready')
    message.value =
      'Readiness berhasil. Status ini belum memeriksa proses worker atau kredensial Google/AI.'
    connection.value = 'success'
  } catch (error) {
    message.value = getApiErrorMessage(error)
    connection.value = 'error'
  } finally {
    checking.value = false
  }
}

async function checkConnection() {
  checking.value = true
  try {
    if (!(await checkBackendHealth())) throw new Error('Respons health backend tidak sesuai.')
    connection.value = 'success'
    message.value = 'Backend aktif dan dapat dihubungi. Kesiapan database belum diperiksa.'
  } catch (error) {
    connection.value = 'error'
    message.value = getApiErrorMessage(error)
  } finally {
    checking.value = false
  }
}

const modules = [
  {
    icon: Sheet,
    title: 'Sumber Google Sheets',
    path: '/workspace',
    description: 'Hubungkan spreadsheet dan kelola sumber data.',
  },
  {
    icon: Database,
    title: 'Pipeline ETL',
    path: '/jobs',
    description: 'Review konfigurasi, sinkronisasi, dan kualitas data.',
  },
  {
    icon: Sparkles,
    title: 'Analisis AI',
    path: '/chat',
    description: 'Jelajahi data melalui pertanyaan bahasa natural.',
  },
]
</script>

<template>
  <div class="min-h-screen">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-5">
        <span class="rounded-xl bg-brand-600 p-2.5 text-white"
          ><Sheet :size="24" aria-hidden="true"
        /></span>
        <span class="text-lg font-semibold tracking-tight">Google Sheet AI</span>
        <RouterLink
          to="/workspace"
          class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white"
          >Buka workspace ETL</RouterLink
        >
        <span class="ml-auto rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
          >Workspace</span
        >
      </div>
    </header>

    <main class="mx-auto max-w-6xl space-y-8 px-6 py-10 sm:py-14">
      <RouterLink to="/dashboard" class="inline-flex rounded-lg bg-brand-600 px-4 py-2 text-white"
        >Buka dashboard data</RouterLink
      >
      <section class="max-w-2xl">
        <p class="mb-3 text-sm font-semibold text-brand-700">DATA WORKSPACE</p>
        <h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">
          Dari spreadsheet menjadi insight.
        </h1>
        <p class="mt-4 leading-7 text-slate-600">
          Fondasi workspace untuk mengelola sumber data, memantau pipeline, dan menyajikan analisis
          dari Google Sheets.
        </p>
      </section>

      <section class="grid gap-4 md:grid-cols-3" aria-label="Modul aplikasi">
        <article
          v-for="item in modules"
          :key="item.title"
          class="rounded-2xl border border-slate-200 bg-white p-6"
        >
          <component :is="item.icon" class="mb-5 text-brand-600" :size="24" aria-hidden="true" />
          <h2 class="font-semibold">{{ item.title }}</h2>
          <p class="mt-2 text-sm leading-6 text-slate-600">{{ item.description }}</p>
          <RouterLink :to="item.path" class="mt-5 flex items-center gap-2 text-sm text-brand-700"
            >Buka modul <ArrowRight :size="14" aria-hidden="true"
          /></RouterLink>
        </article>
      </section>

      <section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 class="flex items-center gap-2 font-semibold">
            <Activity :size="20" class="text-brand-600" aria-hidden="true" /> Aktivitas pemrosesan
          </h2>
          <span class="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800"
            >Data contoh · bukan data backend</span
          >
        </div>
        <ActivityChart />
      </section>

      <section
        class="flex flex-col items-start justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center"
      >
        <div>
          <h2 class="font-semibold">Koneksi FastAPI</h2>
          <p
            role="status"
            class="mt-2 text-sm"
            :class="
              connection === 'error'
                ? 'text-red-700'
                : connection === 'success'
                  ? 'text-brand-700'
                  : 'text-slate-600'
            "
          >
            {{ message }}
          </p>
        </div>
        <button
          type="button"
          :disabled="checking"
          class="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
          @click="checkConnection"
        >
          <RefreshCw :size="16" :class="{ 'animate-spin': checking }" aria-hidden="true" />
          {{ checking ? 'Memeriksa…' : 'Periksa koneksi' }}
        </button>
      </section>
      <section class="rounded-2xl border border-slate-200 bg-white p-6">
        <button
          :disabled="checking"
          class="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50"
          @click="checkReadiness"
        >
          Periksa kesiapan database &amp; Redis
        </button>
        <pre v-if="healthDetails" class="mt-4 overflow-auto text-sm">{{
          JSON.stringify(healthDetails, null, 2)
        }}</pre>
      </section>
    </main>
  </div>
</template>
